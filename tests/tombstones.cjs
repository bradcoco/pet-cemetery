const assert=require('node:assert/strict')
exports.validation=function({model,domain,input,markers}){
  for(const stone of ['arch','star','garden','heart','photo']){
    const form={...input,stone,markerPhoto:'cloud://env/memories/owner/pet.jpg',memorialNotebook:false}
    assert.equal(model.validateMemorial(form),'');assert.equal(domain.cleanInput(form,'owner').stone,stone)
    assert.equal(domain.cleanInput(form,'owner').memorialNotebook,false)
    assert.ok(markers.markerAsset(form).endsWith('stone-'+stone+'.png'))
    // Exercise every drawing path with and without a portrait, including aspect-fill cropping.
    for(const image of [null,{width:300,height:100}]){
      const draws=[];const ctx=new Proxy({drawImage(...args){draws.push(args)}},{get:(target,key)=>target[key]||(()=>{})})
      markers.drawPetMarker(ctx,form,image);assert.equal(draws.length,image?1:0)
      if(image){const [,x,y,w,h]=draws[0];assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>=h)}
    }
  }
  for(const bad of [{stone:'photo',photos:[],markerPhoto:''},{memorialNotebook:'true'},{markerPhoto:9},{markerPhoto:'x'.repeat(501)}])assert.ok(model.validateMemorial({...input,...bad}))
  for(const bad of [{stone:'photo',photos:[],markerPhoto:''},{memorialNotebook:'true'},{markerPhoto:'https://example.com/pet.jpg'},{markerPhoto:'cloud://env/memories/other/pet.jpg'}])assert.throws(()=>domain.cleanInput({...input,...bad},'owner'))
  assert.equal(domain.cleanInput({...input,stone:'photo',photos:['cloud://env/memories/owner/cover.jpg']},'owner').stone,'photo')
  assert.equal(markers.markerPhoto({...input,photos:['local-cover'],photoUrls:['signed-cover'],markerPhoto:'local-custom',markerPhotoUrl:'signed-custom'}),'signed-custom')
  assert.equal(markers.markerPhoto({...input,photos:['local-cover'],photoUrls:['signed-cover']}),'signed-cover')
}
exports.local=async function({store,storage,id}){
 const before=structuredClone(storage.get('xingyu.memorials.v1'))
 try{
  const original=await store.getMemorial(id)
  await store.saveMemorial({...original,stone:'photo',markerPhoto:'wxfile://custom-marker',memorialNotebook:false},id,'stone-edit',true)
  const updated=await store.getMemorial(id)
  assert.equal(updated.markerPhoto,'wxfile://custom-marker');assert.equal(updated.memorialNotebook,false);assert.equal(updated.stone,'photo')
  for(const key of ['no','photos','flowers','gifts','story','notebookPrivacy'])assert.deepEqual(updated[key],original[key])
  const {markerPhoto,memorialNotebook,...legacy}=updated
  await store.saveMemorial({...legacy,stone:'photo'},id,'legacy-edit',true)
  assert.equal((await store.getMemorial(id)).markerPhoto,markerPhoto);assert.equal((await store.getMemorial(id)).memorialNotebook,memorialNotebook)
 }finally{storage.set('xingyu.memorials.v1',before)}
}
exports.cloud=async function({call,table,clone,id}){
 const original=clone(table('memorials').get(id)),photo='cloud://env/memories/owner-a/marker.jpg'
 const ok=async(user,event)=>{const r=await call(user,event);assert.equal(r.ok,true,r.error);return r.data}
 try{
  const form={...original,lifeStatus:'departed',hasMemorial:true,departed:'2025-01-01',locationName:'想念的地方',latitude:30,longitude:120,stone:'photo',markerPhoto:photo,memorialNotebook:false,privacy:'public',notebookEnabled:true,notebookPrivacy:'private'}
  await ok('owner-a',{action:'save',id,input:form})
  const guest=await ok('owner-c',{action:'get',id});assert.equal(guest.markerPhoto,photo);assert.ok(guest.markerPhotoUrl);assert.equal(guest.memorialNotebook,false)
  assert.ok((await ok('owner-c',{action:'list'})).find(p=>p.id===id).markerPhotoUrl)
  assert.equal((await call('owner-c',{action:'notebook',memorialId:id})).ok,false)
  assert.equal((await call('owner-c',{action:'save',id,input:form})).ok,false)
  assert.equal((await call('owner-a',{action:'save',id,input:{...form,markerPhoto:'cloud://env/memories/owner-c/other.jpg'}})).ok,false)
  const {markerPhoto,memorialNotebook,...legacy}=form
  await ok('owner-a',{action:'save',id,input:{...legacy,stone:'heart'}})
  assert.equal(table('memorials').get(id).markerPhoto,markerPhoto);assert.equal(table('memorials').get(id).memorialNotebook,memorialNotebook)
  await ok('owner-a',{action:'petPrivacy',id,patch:{privacy:'private'}})
  assert.equal((await call('owner-c',{action:'get',id})).ok,false)
 }finally{table('memorials').set(id,original)}
 console.log('✓ 云端墓碑：照片归属与访问权限校验、独立标记签名、旧编辑兼容，样式与链接不改变笔记权限')
}
exports.upload=async function(file){
 const previousPage=global.Page,previousCanUse=wx.canIUse,previousChooseMedia=wx.chooseMedia
 let definition
 global.Page=page=>{definition=page}
 try{
  require(file)
  wx.canIUse=()=>true;wx.chooseMedia=async()=>({tempFiles:[{tempFilePath:'temp-photo.jpg'}]})
  const page={...definition,data:structuredClone(definition.data),setData(patch){for(const [key,value] of Object.entries(patch)){const parts=key.split('.');let current=this.data;for(const part of parts.slice(0,-1))current=current[part];current[parts.at(-1)]=value}}}
  await page.markerPhoto();assert.equal(page.data.form.markerPhoto,'saved:temp-photo.jpg');assert.equal(page.data.markerView,'saved:temp-photo.jpg');assert.equal(page.data.uploading,false)
  await page.addPhotos();assert.deepEqual(page.data.form.photos,['saved:temp-photo.jpg']);assert.deepEqual(page.data.photoViews,['saved:temp-photo.jpg'])
  wx.chooseMedia=async()=>{throw {errMsg:'chooseMedia:fail cancel'}}
  await page.markerPhoto();assert.equal(page.data.markerView,'saved:temp-photo.jpg');assert.equal(page.data.uploading,false)
 }finally{global.Page=previousPage;wx.canIUse=previousCanUse;wx.chooseMedia=previousChooseMedia}
}
exports.links=async function({file,store,storage,id}){
 const oldPage=global.Page,oldGetPages=global.getCurrentPages,records=structuredClone(storage.get('xingyu.memorials.v1')),methods=['hideShareMenu','setNavigationBarTitle','navigateTo','redirectTo'],oldMethods=methods.map(key=>wx[key]),routes=[]
 let definition
 global.Page=page=>{definition=page};global.getCurrentPages=()=>[]
 try{
  require(file);for(const key of methods)wx[key]=options=>routes.push(options)
  const base={...await store.getMemorial(id),lifeStatus:'departed',hasMemorial:true,departed:'2025-01-01',privacy:'public',notebookPrivacy:'public',notebookEnabled:true,memorialNotebook:true}
  const page=()=>({...definition,id,data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch)}})
  for(const [patch,preview,canOpen,hint] of [[{},true,true,/阅读/],[{notebookPrivacy:'private'},true,false,/未公开/],[{notebookPrivacy:'private'},false,true,/私密/],[{notebookEnabled:false},false,false,/未开启/],[{memorialNotebook:false},false,false,/暂未展示/]]){
   storage.set('xingyu.memorials.v1',[{...base,...patch}]);const p=page();p.data.visitorPreview=preview;await p.load();assert.equal(p.data.error,'');assert.equal(p.data.canOpenNotebook,canOpen);assert.match(p.data.notebookHint,hint)
   const count=routes.length;p.notebook();assert.equal(routes.length,count+(canOpen?1:0));if(canOpen)assert.equal(routes.at(-1).url,`/pages/notebook/notebook?id=${id}${preview?'&preview=1':''}`)
   p.openArchive();assert.equal(routes.at(-1).url,`/pages/memorial/memorial?id=${id}&view=archive${preview?'&preview=1':''}`)
  }
  storage.set('xingyu.memorials.v1',[{...base,memorialNotebook:false}]);const archive=page();archive.data.archiveView=true;archive.data.visitorPreview=true;await archive.load();assert.equal(archive.data.showTombstone,false);assert.equal(archive.data.hasMemorial,true);assert.equal(archive.data.canOpenNotebook,true);assert.equal(archive.data.memorial.owner,false);archive.openTombstone();assert.equal(routes.at(-1).url,`/pages/memorial/memorial?id=${id}&preview=1`)
  storage.set('xingyu.memorials.v1',[{...base,privacy:'private'}]);await archive.load();assert.equal(archive.data.memorial,null);assert.ok(archive.data.error)
 }finally{global.Page=oldPage;global.getCurrentPages=oldGetPages;methods.forEach((key,i)=>wx[key]=oldMethods[i]);storage.set('xingyu.memorials.v1',records)}
}
