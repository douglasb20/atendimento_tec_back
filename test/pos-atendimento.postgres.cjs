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
const { SupportChatEventsRepository } = require('../dist/support-chats/support-chat-events.repository');
const { ChatbotsRepository } = require('../dist/chatbots/chatbots.repository');
const { ChatbotsService } = require('../dist/chatbots/chatbots.service');
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
const { HandoffHandler } = require('../dist/chatbot-engine/node-handlers/handoff.handler');
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
    for (const tabela of ['support_chats', 'chatbot_flow_executions', 'support_chat_events', 'chatbot_flow_versions']) {
      await qr.query(`CREATE TEMP SEQUENCE teste_${tabela}_id START 1000`);
      await qr.query(`ALTER TABLE pg_temp.${tabela} ALTER COLUMN id SET DEFAULT nextval('pg_temp.teste_${tabela}_id')`);
    }
    await qr.query(`INSERT INTO support_chat_status (id, name, is_final) VALUES (1,'Aguardando',false),(2,'Em atendimento',false),(3,'Em chatbot',false),(5,'Finalizado',true),(7,'Finalizado pelo chatbot',true);
      INSERT INTO channels (id, name, channel_status_id, session_id, chatbot_habilitado) VALUES (4,'Canal fictício',3,'teste-sem-provider',true);
      INSERT INTO contacts (id,name,avatar_url,remote_jid,has_no_client) VALUES (3,'Contato fictício','','teste@invalid',true);
      INSERT INTO support_chats (id,channel_id,contact_id,user_id,protocol,support_chat_status_id,answered_at)
        VALUES (42,4,3,7,'PROTOCOLO-ORIGINAL',2,NOW() - INTERVAL '10 minutes');
      INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES (8,'Saída fictícia','saida',true,9);
      INSERT INTO channel_x_chatbot (channel_id,chatbot_id) VALUES (4,8);
      INSERT INTO attendance_settings (chave,valor) VALUES ('chatbot_habilitado','true');`);
    await qr.query(`INSERT INTO departments (id,name) VALUES (10,'Setor fictício A'),(11,'Setor fictício B'),(12,'Sem vínculo');
      INSERT INTO channel_x_department (channel_id,department_id) VALUES (4,10),(4,11);
      INSERT INTO users (id,name,email,password,avatar_url,lastlogin_at,schedule_color,status) VALUES
        (7,'Equipe múltipla','multi@invalid','sem-login','',NOW(),'#112233',1),
        (8,'Equipe única','unico@invalid','sem-login','',NOW(),'#223344',1),
        (9,'Inativo','inativo@invalid','sem-login','',NOW(),'#334455',0);
      INSERT INTO user_x_department (user_id,department_id) VALUES (7,10),(7,11),(8,10),(9,10);`);
    const no = (id, type, data = {}) => ({ id, type, data, position: { x: 0, y: 0 } });
    const aresta = (source, target, sourceHandle = null) => ({ id: `${source}-${target}-${sourceHandle}`, source, target, sourceHandle, targetHandle: null });
    const grafo = { nodes: [no('inicio','start'), no('mensagem','message', { value:'Aguardando resposta', continueOn:'after_reply',
      replyTimeoutEnabled:true, replyTimeoutMinutes:1 }), no('fim','finish')],
      edges: [aresta('inicio','mensagem'), aresta('mensagem','fim','saida-direita'), aresta('mensagem','fim','sem-resposta')] };
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
      supportChatEventsRepository:new SupportChatEventsRepository(banco),
      chatbotFlowExecutionsRepository:execucoesRepo, logger:{warn:()=>{},log:()=>{}} });
    let despedidas = 0;
    servico.enviaMensagemAutomatica = async () => { despedidas++; };
    servico.recarregaEEmiteEstado = id => repo.findParaEstado(id,qr.manager);
    servico.whatsappChatStateEmit = async () => {};
    const mensagens = [];
    const conversasPermitidas = new Set(['42']);
    const criarMotor = () => new ExecutionEngine(banco,execucoesRepo,new ChatbotFlowVersionsRepository(banco),
      new NodeHandlersRegistry([new StartHandler(),new MessageHandler(),new MenuHandler(),new FinishHandler(),new CloseSupportChatHandler(),new HandoffHandler()]),
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
        aresta('menu','limite','limite-tentativas'),aresta('limite','fim','saida-inferior')] };
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

    await qr.query('UPDATE support_chats SET support_chat_status_id=5,finished_at=NOW() WHERE id=$1',[anteriorId]);
    const entradaComSaida = {nodes:[no('inicio','start'),no('mensagem','message',{value:'Entrada antes de encerrar',continueOn:'auto'}),
      no('encerrar','close_support_chat',{enviarDespedida:true,executarFluxoSaida:true})],
      edges:[aresta('inicio','mensagem'),aresta('mensagem','encerrar','saida-direita')]};
    const saidaComEncerrar = {...grafo,nodes:grafo.nodes.map(n=>n.id==='fim'
      ?no('fim','close_support_chat',{enviarDespedida:true,executarFluxoSaida:true}):n)};
    await qr.query('UPDATE chatbot_flow_versions SET graph=$1 WHERE id=9',[saidaComEncerrar]);
    await qr.query('UPDATE channels SET chatbot_saida_por_padrao=false WHERE id=4');
    await qr.query("INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES (30,'Entrada com saída','entrada',true,40)");
    await qr.query("INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES (40,30,'published',$1,1)",[entradaComSaida]);
    const chatBot = await qr.manager.save(SupportChats,{channel_id:4,contact_id:3,user_id:null,
      support_chat_status_id:3,protocol:'ENCERRAMENTO-DO-BOT'});
    conversasPermitidas.add(String(chatBot.id));
    const entradaBot = await execucoes.iniciar(3,chatBot.id,{id:30,current_published_version_id:40},qr.manager);
    const despedidasAntes = despedidas;
    const protocolosAntes = protocolosNovos;
    await criarMotor().step(entradaBot.id,{kind:'start'});
    let posBot = await repo.findParaEstado(chatBot.id,qr.manager);
    assert.equal(posBot.support_chat_status_id,7); assert.equal(posBot.user_id,null);
    assert.equal(posBot.pos_atendimento_ativo,true); assert.equal(despedidas,despedidasAntes+1);
    assert.equal(posBot.observation_user,'Finalizado pelo chatbot');
    const terminoBot = posBot.finished_at.toISOString();
    const [saidaBot] = await qr.query("SELECT id FROM chatbot_flow_executions WHERE support_chat_id=$1 AND phase='saida'",[chatBot.id]);
    await criarMotor().step(saidaBot.id,{kind:'start'});
    const mesmoChat = await repo.findOrOpenComSinal(3,4,qr.manager);
    assert.equal(String(mesmoChat.supportChat.id),String(chatBot.id));
    assert.equal(mesmoChat.criada,false); assert.equal(protocolosNovos,protocolosAntes);
    const respostaBot = await servico.decideAcaoDoChatbot(3,mesmoChat.supportChat,{id:4},false,'Obrigado',qr.manager,true);
    await criarMotor().step(saidaBot.id,{kind:'resume',waitingToken:respostaBot.waitingToken,resumePayload:{text:'Obrigado'}});
    posBot = await repo.findParaEstado(chatBot.id,qr.manager);
    assert.equal(posBot.pos_atendimento_ativo,false); assert.equal(posBot.support_chat_status_id,7);
    assert.equal(posBot.finished_at.toISOString(),terminoBot); assert.equal(posBot.user_id,null);
    assert.equal(despedidas,despedidasAntes+1);
    assert.equal((await qr.query("SELECT COUNT(*)::int total FROM chatbot_flow_executions WHERE support_chat_id=$1 AND phase='saida'",[chatBot.id]))[0].total,1);
    assert.equal(await repo.buscaAberta(3,4,qr.manager),null);
    console.log('PostgreSQL: Encerrar do bot inicia saída no mesmo protocolo, independente do padrão humano; resposta e fechamento preservam status e término; Encerrar na saída não repete despedida nem inicia outra saída.');

    let idDestinoAnterior;
    for (const [indice,dados] of [
      {destination:'department',department_id:10},
      {destination:'user',department_id:11,user_id:7},
      {destination:'user',department_id:10,user_id:8},
    ].entries()) {
      if (idDestinoAnterior) await qr.query('UPDATE support_chats SET support_chat_status_id=5,finished_at=NOW() WHERE id=$1',[idDestinoAnterior]);
      const conversa = await qr.manager.save(SupportChats,{channel_id:4,contact_id:3,user_id:null,department_id:10,
        support_chat_status_id:3,protocol:`ENCAMINHAMENTO-${indice}`});
      idDestinoAnterior=conversa.id; conversasPermitidas.add(String(conversa.id));
      const botId=60+indice,versaoId=70+indice;
      const entrega={nodes:[no('inicio','start'),no('aviso','message',{value:`Encaminhando ${indice}`}),no('humano','handoff',dados)],
        edges:[aresta('inicio','aviso'),aresta('aviso','humano','saida-direita')]};
      await qr.query("INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES ($1,$3,'entrada',true,$2)",[botId,versaoId,`Encaminhamento fictício ${indice}`]);
      await qr.query("INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES ($1,$2,'published',$3,1)",[versaoId,botId,entrega]);
      const exec=await execucoes.iniciar(3,conversa.id,{id:botId,current_published_version_id:versaoId},qr.manager);
      await criarMotor().step(exec.id,{kind:'start'});
      const apos=await repo.findParaEstado(conversa.id,qr.manager);
      assert.equal(apos.protocol,`ENCAMINHAMENTO-${indice}`); assert.equal(apos.department_id,dados.department_id);
      assert.equal(apos.user_id,dados.user_id??null); assert.equal(apos.support_chat_status_id,dados.user_id?2:1);
      assert.equal(apos.finished_at,null); assert.equal(apos.pos_atendimento_ativo,false);
      assert.equal(Boolean(apos.answered_at),Boolean(dados.user_id));
      const [evento]=await qr.query('SELECT tipo,user_origem_id,user_destino_id,department_destino_id FROM support_chat_events WHERE support_chat_id=$1',[conversa.id]);
      assert.equal(evento.tipo,'encaminhamento'); assert.equal(evento.user_origem_id,null);
      assert.equal(evento.user_destino_id,dados.user_id??null); assert.equal(evento.department_destino_id,dados.department_id);
      assert.equal(mensagens.filter(texto=>texto===`Encaminhando ${indice}`).length,1);
      const mesma=await repo.findOrOpenComSinal(3,4,qr.manager);
      assert.equal(String(mesma.supportChat.id),String(conversa.id)); assert.equal(mesma.criada,false);
      await criarMotor().step(exec.id,{kind:'start'});
      assert.equal((await qr.query('SELECT COUNT(*)::int total FROM support_chat_events WHERE support_chat_id=$1',[conversa.id]))[0].total,1);
    }
    // Um humano que assumiu não pode perder o atendimento para um encaminhamento atrasado.
    await servico.encaminharPorChatbot(idDestinoAnterior,{departmentId:11,userId:7});
    assert.equal((await repo.findParaEstado(idDestinoAnterior,qr.manager)).user_id,8);
    await qr.query('UPDATE support_chats SET support_chat_status_id=5,finished_at=NOW() WHERE id=$1',[idDestinoAnterior]);
    for (const destino of [{departmentId:12,userId:null},{departmentId:11,userId:8},{departmentId:10,userId:9}]) {
      const conversa=await qr.manager.save(SupportChats,{channel_id:4,contact_id:3,user_id:null,department_id:10,
        support_chat_status_id:3,protocol:`INVALIDO-${destino.departmentId}-${destino.userId}`});
      await assert.rejects(servico.encaminharPorChatbot(conversa.id,destino));
      const apos=await repo.findParaEstado(conversa.id,qr.manager);
      assert.equal(apos.support_chat_status_id,3);assert.equal(apos.user_id,null);assert.equal(apos.department_id,10);
      assert.equal((await qr.query('SELECT COUNT(*)::int total FROM support_chat_events WHERE support_chat_id=$1',[conversa.id]))[0].total,0);
    }
    console.log('PostgreSQL: encaminhamento para fila e atendentes de um/vários setores preserva o protocolo, grava histórico uma vez e valida setor do canal, vínculo e status; não sobrescreve atribuição humana.');

    // Publicação usa os serviços reais e versões imutáveis, sem alterar fluxos reais.
    await qr.query('UPDATE support_chats SET support_chat_status_id=5,finished_at=NOW() WHERE support_chat_status_id IN (1,2,3)');
    const grafoVersao = nome => ({nodes:[no('inicio','start'),no('pergunta','message',{
      value:`Versão ${nome}`,continueOn:'after_reply',replyTimeoutEnabled:true,replyTimeoutMinutes:1}),
      no('resposta','message',{value:`Fim ${nome}`}),no('fim','finish')],
      edges:[aresta('inicio','pergunta'),aresta('pergunta','resposta','saida-direita'),
        aresta('pergunta','fim','sem-resposta'),aresta('resposta','fim','saida-inferior')]});
    const anterior=grafoVersao('anterior'),novaVersao=grafoVersao('nova');
    await qr.query("INSERT INTO chatbots (id,name,type,active,current_published_version_id) VALUES (80,'Publicação fictícia','entrada',true,101)");
    await qr.query("INSERT INTO chatbot_flow_versions (id,chatbot_id,status,graph,version_number) VALUES (100,80,'draft',$1,0),(101,80,'published',$1,1)",[anterior]);
    await qr.query('INSERT INTO channel_x_chatbot (channel_id,chatbot_id) VALUES (4,80)');
    const publicar = new ChatbotsService(fluxos,new ChatbotFlowVersionsRepository(banco),{},banco);
    const abrirExecucao = async protocolo => {
      const chat=await qr.manager.save(SupportChats,{channel_id:4,contact_id:3,user_id:null,support_chat_status_id:3,protocol:protocolo});
      conversasPermitidas.add(String(chat.id));
      const exec=await execucoes.iniciar(3,chat.id,await fluxos.findEntradaAtivoDoCanal(4,qr.manager),qr.manager);
      await criarMotor().step(exec.id,{kind:'start'});
      return exec;
    };
    const execAntiga=await abrirExecucao('VERSAO-ANTERIOR');
    const salvo=await publicar.saveFlow(80,novaVersao);
    assert.equal(salvo.has_unpublished_changes,true);
    const antesPublicar=await publicar.findOne(80);
    assert.equal(String(antesPublicar.current_published_version_id),'101');assert.equal(antesPublicar.has_unpublished_changes,true);
    assert.equal((await publicar.findDraft(80)).has_unpublished_changes,true);
    assert.equal((await publicar.findAll()).find(bot=>bot.id===80).has_unpublished_changes,true);
    assert.deepEqual((await qr.query('SELECT graph FROM chatbot_flow_versions WHERE id=101'))[0].graph,anterior);
    const pub=await publicar.publish(80);
    assert.notEqual(String(pub.current_published_version_id),'101');assert.equal(pub.has_unpublished_changes,false);
    const versaoNovaId=pub.current_published_version_id;
    const [antigaPendente]=await qr.query('SELECT flow_version_id,waiting_for FROM chatbot_flow_executions WHERE id=$1',[execAntiga.id]);
    assert.equal(String(antigaPendente.flow_version_id),'101');
    await criarMotor().step(execAntiga.id,{kind:'resume',waitingToken:antigaPendente.waiting_for.token,resumePayload:{text:'Continuar'}});
    assert.equal(mensagens.at(-1),'Fim anterior');
    await publicar.publish(80);
    assert.equal((await qr.query('SELECT COUNT(*)::int total FROM chatbot_flow_versions WHERE chatbot_id=80'))[0].total,3);
    const execNova=await abrirExecucao('VERSAO-NOVA');
    assert.equal(mensagens.at(-1),'Versão nova');
    assert.equal(String((await qr.query('SELECT flow_version_id FROM chatbot_flow_executions WHERE id=$1',[execNova.id]))[0].flow_version_id),String(versaoNovaId));
    const retirada=await publicar.unpublish(80);
    assert.equal(retirada.current_published_version_id,null);
    assert.deepEqual((await publicar.findDraft(80)).graph,novaVersao);
    const [novaPendente]=await qr.query('SELECT waiting_for,status FROM chatbot_flow_executions WHERE id=$1',[execNova.id]);
    assert.equal(novaPendente.status,'suspended');
    await criarMotor().step(execNova.id,{kind:'resume',waitingToken:novaPendente.waiting_for.token,resumePayload:{text:'Continuar'}});
    assert.equal(mensagens.at(-1),'Fim nova');
    await assert.rejects(execucoes.iniciar(3,execNova.support_chat_id,await fluxos.findEntradaAtivoDoCanal(4,qr.manager),qr.manager),/versão publicada/);
    assert.deepEqual((await qr.query('SELECT graph FROM chatbot_flow_versions WHERE id=101'))[0].graph,anterior);
    console.log('PostgreSQL: salvar rascunho mantém a publicação; publicar alterações preserva execução antiga e novas usam a versão nova; publicação idêntica não duplica versão; despublicar preserva rascunho e conversas em andamento.');
  } finally {
    await qr.rollbackTransaction(); await qr.release(); await conexao.destroy();
  }
}
testar().catch(erro=>{console.error(erro.message);process.exitCode=1;});
