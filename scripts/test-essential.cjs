'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),os=require('os'),crypto=require('crypto');
const lib=path.resolve(__dirname,'../launcher/lib'),cfg=require(lib+'/config'),mods=require(lib+'/mods'),http=require(lib+'/http'),ess=require(lib+'/essential'),builds=require(path.resolve(__dirname,'../launcher/essential-builds.json')).builds;
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xrn-essential-test-'));let current=root,enabled=true,calls=0,fail=false;
cfg.load=()=>({gameDir:current,essentialEnabled:enabled});mods.profilsMod=()=>[{version:'fixture-121',base:'1.21.11',loader:{id:'fabric'}},{version:'fixture-26',base:'26.2',loader:{id:'fabric'}}];
// Tiny valid ZIP fixtures exercise the installer without downloading or redistributing Essential.
function zipManifest(id){
 const name=Buffer.from('fabric.mod.json'),data=Buffer.from(JSON.stringify({schemaVersion:1,id,version:'1.0'}));
 let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 const cd=Buffer.concat([central,name]),prefix=Buffer.concat([local,name,data]),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(prefix.length,16);return Buffer.concat([prefix,cd,end]);
}
const fixtures=builds.map((b,i)=>zipManifest(i?'essential':'essential-container'));
for(let i=0;i<builds.length;i++){builds[i].size=fixtures[i].length;builds[i].sha512=crypto.createHash('sha512').update(fixtures[i]).digest('hex');}
http.download=async(url,dest)=>{calls++;if(fail)throw Error('fixture_network_failure');const i=builds.findIndex(b=>b.url===url);assert.ok(i>=0);fs.writeFileSync(dest,fixtures[i]);};
const active=()=>fs.readdirSync(path.join(current,'mods')).filter(n=>n.endsWith('.jar'));
const digest=f=>crypto.createHash('sha512').update(fs.readFileSync(f)).digest('hex');
(async()=>{
 const a=await ess.ensure('fixture-121',current);assert.equal(a.status,'installed');assert.equal(active().length,1);assert.equal(digest(path.join(current,'mods',a.file)),builds[0].sha512);assert.equal(calls,1);
 const again=await ess.ensure('fixture-121',current);assert.equal(again.reused,true);assert.equal(calls,1,'No network for an installed verified build');
 const b=await ess.ensure('fixture-26',current);assert.equal(active().length,1);assert.equal(b.file,builds[1].filename);assert.equal(calls,2);assert.ok(fs.readdirSync(path.join(current,'mods')).some(n=>n.includes('.xrn-incompatible.')));
 enabled=false;await ess.ensure('fixture-26',current);assert.equal(active().length,0);enabled=true;await ess.ensure('fixture-121',current);assert.equal(calls,2,'Cached JAR works offline');
 const owned=path.join(current,'mods',builds[0].filename);fs.renameSync(owned,owned+'.disabled');const disabled=await ess.ensure('fixture-26',current);assert.equal(disabled.status,'disabled');assert.equal(active().length,0);assert.equal(calls,2);
 fs.renameSync(owned+'.disabled',path.join(current,'mods','my-renamed-mod.jar'));const manual=await ess.ensure('fixture-121',current);assert.equal(manual.status,'existing');assert.equal(manual.file,'my-renamed-mod.jar');assert.equal(active().length,1);assert.equal(calls,2,'Renamed Essential detected by mod ID');
 assert.throws(()=>ess.validated({...builds[0],url:'https://example.com/a.jar'},{version:'1.21.11',loader:'fabric'}));assert.throws(()=>ess.validated({...builds[0],filename:'../outside.jar'},{version:'1.21.11',loader:'fabric'}));
 current=fs.mkdtempSync(path.join(os.tmpdir(),'xrn-essential-failure-'));await ess.ensure('fixture-121',current);const before=fs.readFileSync(path.join(current,'mods',builds[0].filename));fail=true;await assert.rejects(()=>ess.ensure('fixture-26',current),/fixture_network_failure/);assert.deepEqual(fs.readFileSync(path.join(current,'mods',builds[0].filename)),before);assert.deepEqual(active(),[builds[0].filename]);fail=false;
 fs.appendFileSync(path.join(current,'mods',builds[0].filename),'fixture-corrupt');await assert.rejects(()=>ess.ensure('fixture-26',current),/modifie/);assert.equal(active().length,1,'Modified user file is not overwritten');
 console.log('ESSENTIAL_ALL_PASS');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
