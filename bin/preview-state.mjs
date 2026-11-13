import {mkdir,open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
export async function preparePreview(client,values,articleId,timeoutMs,expectedRevisionId){
 if(!values.reviewer||!values['operation-key'])throw Error('Preview requires --reviewer reviewer.json and --operation-key KEY');
 const reviewer=JSON.parse(await readFile(values.reviewer,'utf8'));
 const key=createHash('sha256').update(JSON.stringify(['preview',values['api-url']??'https://api.scalemule.com',values.publication,articleId,values['operation-key']])).digest('hex');
 const path=values.state??join(homedir(),'.scalemule','newsroom','operations',key+'.preview.json');
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 const lockPath=path+'.lock';let lock;
 try{lock=await open(lockPath,'wx',0o600);}catch(error){
  if(error.code!=='EEXIST')throw error;
  const pid=Number(await readFile(lockPath,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid operation lock; inspect '+lockPath);
  let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
  if(alive)throw Error('This preview operation is already running');
  await unlink(lockPath);lock=await open(lockPath,'wx',0o600);
 }
 await lock.writeFile(String(process.pid));await lock.close();
 try{
  let checkpoint;try{checkpoint=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const result=await client.previewArticle({articleId,reviewer,checkpoint,timeoutMs,expectedRevisionId,saveCheckpoint:async state=>{
   const temp=path+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,path);
  }});
  // Full capability is retained privately, not written into routine CLI logs.
  const {url,...receipt}=result;
  return {...receipt,invitation_file:path,...(values['show-private-url']?{url}:{})};
 }finally{await unlink(lockPath);}
}
