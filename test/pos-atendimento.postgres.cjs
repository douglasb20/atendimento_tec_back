/* Executar após npm run build: node test/pos-atendimento.postgres.cjs.
 * Só usa tabelas e sequences temporárias, sem WhatsApp ou Redis reais. */
require('dotenv').config({ quiet: true });
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { SupportChats } = require('../dist/support-chats/entities/support-chats.entity');
const { SupportChatsRepository } = require('../dist/support-chats/support-chats.repository');
const { SupportChatsService } = require('../dist/support-chats/support-chats.service');
const { ChatbotsRepository } = require('../dist/chatbots/chatbots.repository');
const { ChatbotFlowVersionsRepository } = require('../dist/chatbots/chatbot-flow-versions.repository');
const { ChatbotFlowExecutionsRepository } = require('../dist/chatbot-engine/chatbot-flow-executions.repository');
const { ChatbotFlowExecutionsService } = require('../dist/chatbot-engine/chatbot-flow-executions.service');
const { ExecutionEngine } = require('../dist/chatbot-engine/execution-engine.service');
const { NodeHandlersRegistry } = require('../dist/chatbot-engine/node-handlers/node-handlers.registry');
const { StartHandler } = require('../dist/chatbot-engine/node-handlers/start.handler');
const { MessageHandler } = require('../dist/chatbot-engine/node-handlers/message.handler');
const { MenuHandler } = require('../dist/chatbot-engine/node-handlers/menu.handler');
const { FinishHandler } = require('../dist/chatbot-engine/node-handlers/finish.handler');
const { CloseSupportChatHandler } = require('../dist/chatbot-engine/node-handlers/close-support-chat.handler');
const { validarTentativasMenu } = require('../dist/chatbots/tentativas-menu');

async function testar() {
  const conexao = new DataSource({ type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    username: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
    entities: ['dist/**/*.entity.js'], synchronize: false, logging: false });
  await conexao.initialize();
  const qr = conexao.createQueryRunner();
  await qr.connect(); await qr.startTransaction();
  try {
    assert.equal(conexao.getMetadata(SupportChats).tablePath, 'support_chats');
    const tabelas = new Set(conexao.entityMetadatas.map(m => m.tableName));
    for (const tabela of new Set(['attendance_settings', 'channel_x_chatbot', ...tabelas])) {
      assert.match(tabela, /^[a-z_]+$/);
      const [existe] = await qr.query('SELECT to_regclass($1) AS nome', [`public.${tabela}`]);
      if (existe.nome) await qr.query(`CREATE TEMP TABLE "${tabela}" (LIKE public."${tabela}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
    }
    for (const tabela of ['support_chats', 'chatbot_flow_executions']) {
      await qr.query(`CREATE TEMP SEQUENCE teste_${tabela}_id START 1000`);
      await qr.query(`ALTER TABLE pg_temp.${tabela} ALTER COLUMN id SET DEFAULT nextval('pg_temp.teste_${tabela}_id')`);
    }
    await qr.query(`INSERT INTO support_chat_status (id, name, is_final) VALUES (1,'Aguardando',false),(2,'Em atendimento',false),(3,'Em chatbot',false),(5,'Finalizado',true);
      INSERT INTO channels (id, name, channel_status_id, session_id, chatbot_habilitado) VALUES (4,'Canal fictício',3,'teste-sem-provider',true);
      INSERT INTO contacts (id,name,avatar_url,remote_jid,has_no_client) VALUES (3,'Contato fictício','','teste@invalid',true);
      INSERT INTO support_chats (id,channel_id,contact_id,user_id,protocol,support_chat_status_id,answered_at)
        VALUES (42,4,3,7,'PROTOCOLO-ORIGINAL',2,NOW() - INTERVAL '10 minutes');
      INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES (8,'Saída fictícia','saida',true,9);
      INSERT INTO channel_x_chatbot (channel_id,chatbot_id) VALUES (4,8);
      INSERT INTO attendance_settings (chave,valor) VALUES ('chatbot_habilitado','true');`);
    const no = (id, type, data = {}) => ({ id, type, data, position: { x: 0, y: 0 } });
    const aresta = (source, target, sourceHandle = null) => ({ id: `${source}-${target}-${sourceHandle}`, source, target, sourceHandle, targetHandle: null });
    const grafo = { nodes: [no('inicio','start'), no('mensagem','message', { value:'Aguardando resposta', continueOn:'after_reply',
      replyTimeoutEnabled:true, replyTimeoutMinutes:1 }), no('fim','finish')],
      edges: [aresta('inicio','mensagem'), aresta('mensagem','fim'), aresta('mensagem','fim','sem-resposta')] };
    await qr.query(`INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES (9,8,'published',$1,1)`, [grafo]);
    let numeroTransacao = 0;
    const banco = { manager: qr.manager, query: (...args) => qr.query(...args), createQueryRunner: () => {
      const nome = `acao_${++numeroTransacao}`;
      return { manager: qr.manager, connect: async () => {}, release: async () => {},
        startTransaction: () => qr.query(`SAVEPOINT ${nome}`), commitTransaction: () => qr.query(`RELEASE SAVEPOINT ${nome}`),
        rollbackTransaction: async () => { await qr.query(`ROLLBACK TO SAVEPOINT ${nome}`); await qr.query(`RELEASE SAVEPOINT ${nome}`); } };
    } };
    let protocolosNovos = 0;
    const repo = new SupportChatsRepository(banco, { generateProtocol: async () => `NOVO-${++protocolosNovos}` }, {});
    const execucoesRepo = new ChatbotFlowExecutionsRepository(banco);
    const execucoes = new ChatbotFlowExecutionsService({ add: async () => {} }, execucoesRepo);
    const fluxos = new ChatbotsRepository(banco);
    const ajustes = { chatbotHabilitado: async manager => (await (manager ?? banco).query("SELECT valor FROM attendance_settings WHERE chave='chatbot_habilitado'"))[0].valor === 'true' };
    const servico = Object.assign(Object.create(SupportChatsService.prototype), { dataSource:banco, supportChatsRepository:repo,
      attendanceSettingsService:ajustes, chatbotsRepository:fluxos, chatbotFlowExecutionsService:execucoes,
      permissionService:{hasPermission:async()=>true},
      chatbotFlowExecutionsRepository:execucoesRepo, logger:{warn:()=>{}} });
    let despedidas = 0;
    servico.enviaMensagemAutomatica = async () => { despedidas++; };
    servico.recarregaEEmiteEstado = id => repo.findParaEstado(id,qr.manager);
    servico.whatsappChatStateEmit = async () => {};
    const mensagens = [];
    const conversasPermitidas = new Set(['42']);
    const criarMotor = () => new ExecutionEngine(banco,execucoesRepo,new ChatbotFlowVersionsRepository(banco),
      new NodeHandlersRegistry([new StartHandler(),new MessageHandler(),new MenuHandler(),new FinishHandler(),new CloseSupportChatHandler()]),
      {sendMessage:async (_sessao,_contato,texto)=>{mensagens.push(texto);return {messageId:`ficticia-${mensagens.length}`};}},
      servico,{saveOutgoing:async ({supportChat})=>assert.ok(conversasPermitidas.has(String(supportChat.id)))},{});
    const motor = criarMotor();

    servico.permissionService.hasPermission = async () => false;
    await assert.rejects(servico.finalizarAtendimento(42,7,{executar_fluxo_saida:false}), /não tem permissão/);
    assert.equal((await repo.findParaEstado(42,qr.manager)).support_chat_status_id,2);
    assert.equal(despedidas,0);
    await qr.query('UPDATE channels SET chatbot_saida_por_padrao = false WHERE id=4');
    assert.deepEqual(await servico.fluxoSaidaDisponivel(42,7),{id:8,name:'Saída fictícia',executar_por_padrao:false,pode_alterar:false});
    await assert.rejects(servico.finalizarAtendimento(42,7,{executar_fluxo_saida:true}), /não tem permissão/);
    await qr.query('SAVEPOINT padrao_desligado');
    await servico.finalizarAtendimento(42,7,{sem_despedida:true});
    assert.equal((await repo.findParaEstado(42,qr.manager)).pos_atendimento_ativo,false);
    assert.equal((await qr.query('SELECT COUNT(*)::int quantidade FROM chatbot_flow_executions'))[0].quantidade,0);
    await qr.query('ROLLBACK TO SAVEPOINT padrao_desligado'); await qr.query('RELEASE SAVEPOINT padrao_desligado');
    await qr.query('UPDATE channels SET chatbot_saida_por_padrao = true WHERE id=4');
    // Mesmo omitindo a escolha, um atendente sem permissão segue o padrão ligado.
    const finalizado = await servico.finalizarAtendimento(42,7,{sem_despedida:true,observation_user:'Resolvido'});
    assert.equal(finalizado.protocol,'PROTOCOLO-ORIGINAL'); assert.equal(finalizado.pos_atendimento_ativo,true);
    const terminoHumano = finalizado.finished_at.toISOString();
    const [execucao] = await qr.query("SELECT id FROM chatbot_flow_executions WHERE phase='saida'");
    await motor.step(execucao.id,{kind:'start'});
    assert.equal(despedidas,0); assert.deepEqual(mensagens,['Aguardando resposta']);
    const emPos = await repo.findOrOpenComSinal(3,4,qr.manager);
    assert.equal(String(emPos.supportChat.id),'42'); assert.equal(emPos.criada,false); assert.equal(protocolosNovos,0);
    const retomada = await servico.decideAcaoDoChatbot(3,emPos.supportChat,{id:4},false,'Obrigado',qr.manager,true);
    assert.equal(String(retomada.executionId),String(execucao.id));
    await motor.step(execucao.id,{kind:'resume',waitingToken:retomada.waitingToken,resumePayload:{text:'Obrigado'}});
    const concluido = await repo.findParaEstado(42,qr.manager);
    assert.equal(concluido.pos_atendimento_ativo,false); assert.equal(concluido.finished_at.toISOString(),terminoHumano);
    assert.equal(concluido.user_id,7); assert.equal(concluido.observation_user,'Resolvido'); assert.equal(concluido.support_chat_status_id,5);
    assert.equal(despedidas,0); assert.equal(mensagens.length,1);
    assert.equal(await repo.buscaAberta(3,4,qr.manager),null);
    const nova = await repo.findOrOpenComSinal(3,4,qr.manager);
    assert.equal(nova.criada,true); assert.equal(protocolosNovos,1); assert.notEqual(nova.supportChat.protocol,'PROTOCOLO-ORIGINAL');
    console.log('PostgreSQL: padrões ligado/desligado e bloqueio de alteração sem permissão; ciclo completo no mesmo protocolo; duração, dono e relato preservados. Nenhum envio real.');

    const novoId = nova.supportChat.id;
    conversasPermitidas.add(String(novoId));
    const grafoMenu = { nodes: [no('inicio','start'), no('menu','menu',{title:'Escolha uma opção',options:[{id:'suporte',text:'Suporte'}],
      invalidOptionOutputHandle:'invalid',invalidAttemptLimitEnabled:true,maxInvalidAttempts:3}),
      no('limite','message',{value:'Limite de tentativas atingido'}),no('fim','finish')],
      edges:[aresta('inicio','menu'),aresta('menu','menu','invalid'),aresta('menu','fim','suporte'),
        aresta('menu','limite','limite-tentativas'),aresta('limite','fim')] };
    await qr.query("INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES (18,'Menu fictício','entrada',true,10)");
    await qr.query("INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES (10,18,'published',$1,1)",[grafoMenu]);
    await qr.query('UPDATE support_chats SET support_chat_status_id=3 WHERE id=$1',[novoId]);
    const execucaoMenu = await execucoes.iniciar(3,novoId,{id:18,current_published_version_id:10},qr.manager);
    await criarMotor().step(execucaoMenu.id,{kind:'start'});
    for (let tentativa=1; tentativa<=3; tentativa++) {
      const conversa=await repo.findParaEstado(novoId,qr.manager);
      const acao=await servico.decideAcaoDoChatbot(3,conversa,{id:4},false,'errado',qr.manager,true);
      await criarMotor().step(execucaoMenu.id,{kind:'resume',waitingToken:acao.waitingToken,resumePayload:{text:'errado'}});
      const [persistida]=await qr.query('SELECT status, variables FROM chatbot_flow_executions WHERE id=$1',[execucaoMenu.id]);
      if(tentativa<3) {
        assert.equal(persistida.status,'suspended');
        assert.equal(persistida.variables._menu_tentativas_invalidas['10:menu'],tentativa);
      }else assert.equal(persistida.status,'completed');
      const enviosAntes = mensagens.length;
      await criarMotor().step(execucaoMenu.id,{kind:'resume',waitingToken:acao.waitingToken,resumePayload:{text:'errado'}});
      const [duplicada]=await qr.query('SELECT status, variables FROM chatbot_flow_executions WHERE id=$1',[execucaoMenu.id]);
      assert.deepEqual(duplicada,persistida); assert.equal(mensagens.length,enviosAntes);
    }
    assert.equal(mensagens.filter(texto=>texto.startsWith('Escolha uma opção')).length,3);
    assert.equal(mensagens.filter(texto=>texto==='Limite de tentativas atingido').length,1);
    assert.equal((await repo.findParaEstado(novoId,qr.manager)).support_chat_status_id,1);
    console.log('PostgreSQL: contagem do Menu persistida entre novos motores/jobs; terceira inválida segue o limite; jobs duplicados não contam nem enviam novamente.');

    let anteriorId = novoId;
    for (const [acao,botId] of [['repeat_menu',20],['wait_reply',21]]) {
      await qr.query('UPDATE support_chats SET support_chat_status_id=5,finished_at=NOW() WHERE id=$1',[anteriorId]);
      const conversaAuto = await qr.manager.save(SupportChats,{channel_id:4,contact_id:3,user_id:null,
        support_chat_status_id:3,protocol:`MENU-${acao}`});
      anteriorId = conversaAuto.id; conversasPermitidas.add(String(conversaAuto.id));
      const versaoId = botId+10;
      const titulo = `Menu ${acao}`;
      const automatico = { nodes:[no('inicio','start'),no('menu','menu',{title:titulo,options:[{id:'suporte',text:'Suporte'}],
        invalidOptionAction:acao,invalidAttemptLimitEnabled:true,maxInvalidAttempts:3}),
        no('excesso','message',{value:`Excesso ${acao}`}),no('fim','finish')],
        edges:[aresta('inicio','menu'),aresta('menu','fim','suporte'),aresta('menu','excesso','limite-tentativas'),aresta('excesso','fim')] };
      validarTentativasMenu(automatico);
      await qr.query("INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES ($1,$3,'entrada',true,$2)",[botId,versaoId,`Menu ${acao}`]);
      await qr.query("INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES ($1,$2,'published',$3,1)",[versaoId,botId,automatico]);
      const execAuto = await execucoes.iniciar(3,conversaAuto.id,{id:botId,current_published_version_id:versaoId},qr.manager);
      await criarMotor().step(execAuto.id,{kind:'start'});
      for(let tentativa=1;tentativa<=3;tentativa++){
        const chat=await repo.findParaEstado(conversaAuto.id,qr.manager);
        const acaoJob=await servico.decideAcaoDoChatbot(3,chat,{id:4},false,'errado',qr.manager,true);
        await criarMotor().step(execAuto.id,{kind:'resume',waitingToken:acaoJob.waitingToken,resumePayload:{text:'errado'}});
        const [estado]=await qr.query('SELECT status,variables FROM chatbot_flow_executions WHERE id=$1',[execAuto.id]);
        if(tentativa<3){assert.equal(estado.status,'suspended');assert.equal(estado.variables._menu_tentativas_invalidas[`${versaoId}:menu`],tentativa);}
        else assert.equal(estado.status,'completed');
        const totalAntes=mensagens.length;
        await criarMotor().step(execAuto.id,{kind:'resume',waitingToken:acaoJob.waitingToken,resumePayload:{text:'errado'}});
        assert.equal(mensagens.length,totalAntes);
        const [aposDuplicata]=await qr.query('SELECT status,variables FROM chatbot_flow_executions WHERE id=$1',[execAuto.id]);
        assert.deepEqual(aposDuplicata,estado);
      }
      assert.equal(mensagens.filter(texto=>texto.startsWith(titulo)).length,acao==='repeat_menu'?3:1);
      assert.equal(mensagens.filter(texto=>texto===`Excesso ${acao}`).length,1);
    }
    console.log('PostgreSQL: reenviar/aguardar funcionam sem saída inválida conectada; terceira inválida segue Excesso e duplicatas não repetem ações.');
  } finally {
    await qr.rollbackTransaction(); await qr.release(); await conexao.destroy();
  }
}
testar().catch(erro=>{console.error(erro.message);process.exitCode=1;});
