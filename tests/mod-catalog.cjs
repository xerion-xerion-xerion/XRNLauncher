const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
process.env.APPDATA=fs.mkdtempSync(path.join(require('os').tmpdir(),'xrn-catalog-test-'));
const lib=path.resolve(__dirname,'../launcher/lib'),cfg=require(lib+'/config'),mods=require(lib+'/mods'),http=require(lib+'/http');
const game=path.join(process.env.APPDATA,'game');fs.mkdirSync(game,{recursive:true});
cfg.load=()=>({gameDir:game});mods.profilsMod=()=>[{version:'fabric-test',base:'1.21.11',loader:{id:'fabric'}}];
const catalog=require(lib+'/mod-catalog'),realJSON=http.getJSON,realDownload=http.download;
const digest=s=>crypto.createHash('sha512').update(s).digest('hex');
function v(project,version,dep=[]){const content=project+version;return {project_id:project,id:version,name:project,game_versions:['1.21.11'],loaders:['fabric'],version_type:'release',date_published:'2026-01-01',files:[{filename:project+'.jar',size:content.length,url:'https://cdn.modrinth.com/'+project,hashes:{sha512:digest(content)},primary:true}],dependencies:dep};}
const root=v('root','root1',[{project_id:'dep',dependency_type:'required'}]),dep=v('dep','dep1');
http.getJSON=async url=>url.includes('/root/')?[root]:url.includes('/dep/')?[dep]:[];
http.download=async(url,file)=>fs.writeFileSync(file,url.endsWith('root')?'rootroot1':'depdep1');
(async()=>{
 const resolveVersions=http.getJSON;
 http.getJSON=async()=>({hits:[{project_id:'Abcd1234',slug:'a.mod+unusual',title:'Example',icon_url:'https://cdn.modrinth.com/data/icon.png'},{project_id:'../invalid',slug:'unsafe'}],total_hits:2});
 const unusual=await catalog.search('modrinth','','fabric-test',{sort:'downloads',offset:20});
 assert.equal(unusual.items.length,1);assert.equal(unusual.items[0].url,'https://modrinth.com/mod/Abcd1234');assert.equal(unusual.offset,20);assert.equal(unusual.items[0].icon,'https://cdn.modrinth.com/data/icon.png');
 http.getJSON=resolveVersions;
 assert.throws(()=>catalog.fileUrl('https://evil.example/test.jar'));assert.throws(()=>catalog.fileUrl('http://cdn.modrinth.com/a'));
 const beta={...root,id:'beta',version_type:'beta',date_published:'2027-01-01'};assert.equal(catalog.pick([beta,root],{version:'1.21.11',loader:'forge'}),undefined);
 assert.equal(catalog.pick([beta,root],{version:'1.21.11',loader:'fabric'}).id,'root1');
 const p=await catalog.prepare('modrinth','root','fabric-test');assert.equal(p.files.length,2);const r=await catalog.install(p.token);assert.equal(r.installed.length,2);assert.equal(fs.readFileSync(path.join(game,'mods/root.jar'),'utf8'),'rootroot1');
 await assert.rejects(catalog.install(p.token),/expiré/);
 const corrupt=await catalog.prepare('modrinth','root','fabric-test');fs.writeFileSync(path.join(game,'mods/root.jar'),'existing-user-content');await assert.rejects(catalog.install(corrupt.token),/autre fichier/);assert.equal(fs.readFileSync(path.join(game,'mods/root.jar'),'utf8'),'existing-user-content');
 // A dependency that explicitly targets another game version must fail before writing.
 http.getJSON=async url=>url.includes('/root/')?[{...root,dependencies:[{project_id:'dep',version_id:'bad',dependency_type:'required'}]}]:[{...dep,game_versions:['1.8.9']}];
 await assert.rejects(catalog.prepare('modrinth','root','fabric-test'),/dépendance|compatible/);
 console.log('PASS catalog: exact loader/version, release preference, required dependencies, integrity, user-file collision and replay.');
 http.getJSON=realJSON;http.download=realDownload;
 if(!process.argv.includes('--live'))return;
 const live=await catalog.search('modrinth','fabric api','fabric-test');assert.ok(live.items.length);const plan=await catalog.prepare('modrinth','P7dR8mSH','fabric-test');assert.ok(plan.files.some(f=>f.filename.includes('fabric-api')));
 const installed=await catalog.install(plan.token);assert.ok(installed.installed.length);console.log(JSON.stringify({liveModrinthSearch:true,exactVersion:plan.context.version,loader:plan.context.loader,downloadedAndVerified:installed.installed}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{http.getJSON=realJSON;http.download=realDownload;});
