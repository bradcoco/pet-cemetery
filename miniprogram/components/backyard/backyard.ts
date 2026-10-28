import { Memorial, ownPets, PetFilter } from '../../utils/model'
import { emptyGarden, Garden, GardenRecord, PublicGarden, gardenPosition, normalizeGarden, wanderTarget } from '../../utils/garden'
import { getGarden, saveGarden, showError } from '../../services/store'
interface Actor { avatarEmoji:string; id: string; name: string; species: string; x: number; y: number; homeX: number; homeY: number; facing: number; walking: boolean; until: number; happyUntil: number; happy: boolean }
const properties = { records: {type:Array,value:[] as Memorial[]}, refreshing: {type:Boolean,value:false}, readOnly:{type:Boolean,value:false}, publicGarden:{type:Object,value:{layout:emptyGarden(),records:[]} as PublicGarden},visitorPreview:{type:Boolean,value:false} }
interface Data { garden: Garden; actors: Actor[]; graves: GardenRecord[]; warehouse: (Memorial & {placed: boolean})[]; tab: PetFilter; opened: boolean; selected: string; selectedName: string; placing: Memorial | null; loading: boolean; saving: boolean; error: string; bubble: string; bubbleId: string; active: boolean }
type Methods = {[K in 'load'|'sync'|'start'|'stop'|'tick'|'openWarehouse'|'closeWarehouse'|'warehouseTab'|'takeOut'|'sceneTap'|'commit'|'cancelPlace'|'petTap'|'petAction'|'putBack'|'movePet'|'petProfile'|'graveTap'|'createPet'|'stopTap'|'rebuild'|'addGrave'|'removeGrave'|'ballTap'|'returnPet']: (...args:any[])=>any}
Component<Data,typeof properties,Methods,{timer:number|null; cursor:number; detached:boolean; loadingRequest:boolean}>({
  properties,
  data: { garden:emptyGarden(),actors:[],graves:[],warehouse:[],tab:'all',opened:false,selected:'',selectedName:'',placing:null,loading:true,saving:false,error:'',bubble:'',bubbleId:'',active:true },
  observers: { records() { if(this.data) this.sync() },'publicGarden, readOnly'(){if(this.data&&this.properties.readOnly)this.load()} },
  lifetimes: {
    created() { this.timer=null;this.cursor=0;this.detached=false;this.loadingRequest=false },
    attached() { this.load();this.start() },
    detached() { this.detached=true;this.stop() },
  },
  pageLifetimes: { show() { this.setData({active:true});this.start();this.load() }, hide() { this.setData({active:false});this.stop() } },
  methods: {
    async load() {
      if(this.properties.readOnly){this.setData({garden:(this.properties.publicGarden as PublicGarden)?.layout||emptyGarden(),loading:false,error:'',opened:false,placing:null,selected:''});this.sync();return}
      if(this.data.saving||this.loadingRequest) return
      this.loadingRequest=true
      this.setData({loading:true,error:''})
      try { const garden=await getGarden();if(!this.detached){this.setData({garden});this.sync()} }
      catch(error){if(!this.detached)this.setData({error:showError(error)})}
      finally{this.loadingRequest=false;if(!this.detached)this.setData({loading:false})}
    },
    sync() {
      const readOnly=this.properties.readOnly,publicGarden=this.properties.publicGarden as PublicGarden,mine=readOnly?[]:ownPets(this.properties.records as Memorial[]),records:GardenRecord[]=readOnly?publicGarden?.records||[]:mine
      const garden:Garden=readOnly?publicGarden?.layout||emptyGarden():normalizeGarden(this.data.garden,mine),old=new Map(this.data.actors.map(p=>[p.id,p]))
      const actors=garden.pets.map(p=>{
        const pet=records.find(m=>m.id===p.petId)!,previous=old.get(p.petId)
        return previous&&previous.homeX===p.x&&previous.homeY===p.y?{...previous,name:pet.name,species:pet.species,avatarEmoji:pet.avatarEmoji||''}:{id:pet.id,avatarEmoji:pet.avatarEmoji||'',name:pet.name,species:pet.species,x:p.x,y:p.y,homeX:p.x,homeY:p.y,facing:1,walking:false,until:0,happyUntil:0,happy:false}
      })
      const graves=garden.memorials.map(id=>records.find(p=>p.id===id)!),placed=new Set([...garden.pets.map(p=>p.petId),...garden.memorials])
      this.setData({actors,graves,warehouse:readOnly?[]:ownPets(mine,this.data.tab).map(p=>({...p,placed:placed.has(p.id)}))})
      if(this.data.selected&&!actors.some(p=>p.id===this.data.selected))this.setData({selected:'',selectedName:''})
    },
    start() { if(this.timer!==null||this.detached)return;this.timer=setInterval(()=>this.tick(),1000) },
    stop() { if(this.timer!==null)clearInterval(this.timer);this.timer=null },
    tick() {
      if(!this.data.active||!this.data.actors.length||this.data.opened||this.data.placing||this.data.saving)return
      const now=Date.now(), actors=this.data.actors.map(p=>({...p,walking:p.until>now,happy:p.happyUntil>now})), index=this.cursor++%actors.length, actor=actors[index]
      if(actor.id!==this.data.selected&&actor.until<=now&&actor.happyUntil<=now){Object.assign(actor,wanderTarget(actor),{walking:true,until:now+2800})}
      const patch:Record<string,unknown>={actors}
      if(this.data.bubble&&!actors.some(p=>p.id===this.data.bubbleId&&p.happyUntil>now)){patch.bubble='';patch.bubbleId=''}
      this.setData(patch)
    },
    openWarehouse(e?:WechatMiniprogram.TouchEvent){if(this.properties.readOnly)return;this.setData({opened:true,selected:'',placing:null,tab:e&&e.currentTarget.dataset.tab||this.data.tab});this.sync()},
    closeWarehouse(){this.setData({opened:false})},
    warehouseTab(e:WechatMiniprogram.TouchEvent){this.setData({tab:e.currentTarget.dataset.tab});this.sync()},
    takeOut(e:WechatMiniprogram.TouchEvent){
      if(this.properties.readOnly||this.data.saving||this.data.loading)return
      const pet=(this.properties.records as Memorial[]).find(p=>p.id===e.currentTarget.dataset.id&&p.owner&&!p.demo)
      if(!pet)return
      if(pet.lifeStatus!=='alive'){this.addGrave(pet.id);return}
      this.setData({placing:pet,opened:false,selected:''})
    },
    async sceneTap(e:WechatMiniprogram.TouchEvent){
      if(this.properties.readOnly||!this.data.placing||this.data.saving)return
      const pet=this.data.placing
      this.createSelectorQuery().select('.yard-scene').boundingClientRect(rect=>{
        if(!rect||Array.isArray(rect))return
        const touch=e.changedTouches&&e.changedTouches[0], x=touch?touch.clientX:e.detail.x, y=touch?touch.clientY:e.detail.y
        const p={x:(x-rect.left)/rect.width*100,y:(y-rect.top)/rect.height*100}
        if(p.y<50||p.y>93){wx.showToast({title:'请点击前面的草坪放置它',icon:'none'});return}
        const garden=normalizeGarden(this.data.garden,this.properties.records as Memorial[])
        garden.pets=[...garden.pets.filter(p=>p.petId!==pet.id),{petId:pet.id,...gardenPosition(p.x,p.y)}]
        this.commit(garden,pet.name+'来到后院啦')
      }).exec()
    },
    async commit(garden:Garden,message:string){
      if(this.properties.readOnly||this.data.saving)return
      this.setData({saving:true,error:''})
      try{await saveGarden(garden);if(!this.detached){this.setData({garden,placing:null,selected:'',opened:false});this.sync();wx.showToast({title:message,icon:'none'})}}
      catch(error){if(!this.detached)this.setData({error:showError(error)})}
      finally{if(!this.detached)this.setData({saving:false})}
    },
    cancelPlace(){if(!this.data.saving)this.setData({placing:null})},
    petTap(e:WechatMiniprogram.TouchEvent){
      if(this.properties.readOnly){if(this.data.actors.some(p=>p.id===e.currentTarget.dataset.id))this.graveTap(e);return}
      if(this.data.placing)return
      const pet=this.data.actors.find(p=>p.id===e.currentTarget.dataset.id)
      if(pet)this.setData({selected:pet.id,selectedName:pet.name})
    },
    petAction(e:WechatMiniprogram.TouchEvent){
      const action=e.currentTarget.dataset.action, id=this.data.selected, actor=this.data.actors.find(p=>p.id===id)
      if(!actor)return
      const now=Date.now(), actors=this.data.actors.map(p=>p.id===id?{...p,happyUntil:now+3500,happy:true,walking:action==='play',until:now+(action==='play'?2800:0),...(action==='play'?{x:68,y:77,facing:p.x>68?-1:1}:{})}:p)
      this.setData({actors,bubbleId:id,bubble:action==='play'?'一起追球球！':actor.species==='猫咪'?'呼噜呼噜，好舒服～':'好喜欢你的摸摸 ♡'})
    },
    ballTap(){
      const pet=this.data.actors.find(p=>p.id===this.data.selected)||this.data.actors[0]
      if(!pet)return
      this.setData({selected:pet.id,selectedName:pet.name});this.petAction({currentTarget:{dataset:{action:'play'}}})
      if(this.properties.readOnly)this.setData({selected:'',selectedName:''})
    },
    putBack(e?:WechatMiniprogram.TouchEvent){
      if(this.properties.readOnly)return
      const id=e&&e.currentTarget.dataset.id||this.data.selected,garden=normalizeGarden(this.data.garden,this.properties.records as Memorial[])
      garden.pets=garden.pets.filter(p=>p.petId!==id);this.commit(garden,'已经回到宠物仓')
    },
    returnPet(e:WechatMiniprogram.TouchEvent){if(this.properties.readOnly)return;const pet=(this.properties.records as Memorial[]).find(p=>p.id===e.currentTarget.dataset.id);if(pet&&pet.lifeStatus==='alive')this.putBack(e);else this.removeGrave(e)},
    movePet(){if(this.properties.readOnly)return;const pet=(this.properties.records as Memorial[]).find(p=>p.id===this.data.selected);if(pet)this.setData({placing:pet,selected:''})},
    petProfile(){if(this.data.selected)wx.navigateTo({url:'/pages/memorial/memorial?id='+encodeURIComponent(this.data.selected)+(this.properties.visitorPreview?'&preview=1':'')})},
    graveTap(e:WechatMiniprogram.TouchEvent){if(this.properties.readOnly&&!(this.properties.publicGarden as PublicGarden)?.records.some(p=>p.id===e.currentTarget.dataset.id))return;wx.navigateTo({url:'/pages/memorial/memorial?id='+encodeURIComponent(e.currentTarget.dataset.id)+(this.properties.visitorPreview?'&preview=1':'')})},
    addGrave(id:string){if(this.properties.readOnly)return;const garden=normalizeGarden(this.data.garden,this.properties.records as Memorial[]);if(!garden.memorials.includes(id))garden.memorials.push(id);this.commit(garden,'已安放在纪念花园')},
    removeGrave(e:WechatMiniprogram.TouchEvent){if(this.properties.readOnly)return;const garden=normalizeGarden(this.data.garden,this.properties.records as Memorial[]);garden.memorials=garden.memorials.filter(id=>id!==e.currentTarget.dataset.id);this.commit(garden,'纪念物已收回宠物仓')},
    createPet(){if(!this.properties.readOnly)wx.navigateTo({url:'/pages/create/create'})},
    stopTap(){},
    rebuild(){this.load()},
  },
})
