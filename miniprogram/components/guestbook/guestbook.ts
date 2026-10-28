import { deleteGuestbookMessage, isCloud, listGuestbook, postGuestbookMessage, showError } from '../../services/store'
import { GuestbookMessage, guestbookDate, validateGuestbookContent } from '../../utils/guestbook'
import { ProfileCard, requestId } from '../../utils/items'
type MessageView = GuestbookMessage & {dateLabel: string}
const properties={user:{type:String,value:''},visitorPreview:{type:Boolean,value:false}}
interface Data { messages:MessageView[]; loading:boolean; error:string; nextOffset:number|null; content:string; posting:boolean; deleting:string; editorError:string; author:ProfileCard|null; isCloud:boolean }
type Methods={ [K in 'load'|'retry'|'more'|'input'|'post'|'remove'|'showAuthor'|'closeAuthor'|'authorHome'|'stopTap']:(...args:any[])=>any }
Component<Data,typeof properties,Methods,{ready:boolean;request:number;postKey:string}>({
  properties,
  data:{messages:[],loading:true,error:'',nextOffset:null,content:'',posting:false,deleting:'',editorError:'',author:null,isCloud},
  observers:{'user, visitorPreview'(){if(this.ready){this.postKey='';this.setData({content:'',author:null,messages:[],nextOffset:null});this.load()}}},
  lifetimes:{created(){this.ready=false;this.request=0;this.postKey=''},attached(){this.ready=true;this.load()},detached(){this.ready=false;this.request++}},
  pageLifetimes:{show(){if(this.ready)this.load()},hide(){this.setData({author:null})}},
  methods:{
    async load(append=false){
      const user=this.properties.user
      if(!user){this.setData({messages:[],loading:false,nextOffset:null});return}
      if(append&&(this.data.loading||this.data.nextOffset===null))return
      const request=++this.request,offset=append?this.data.nextOffset!:0
      this.setData({loading:true,error:''})
      try{
        const page=await listGuestbook(user,offset,this.properties.visitorPreview)
        if(!this.ready||request!==this.request)return
        const messages=page.messages.map(m=>({...m,dateLabel:guestbookDate(m.createdAt)})),seen=new Set(this.data.messages.map(m=>m.id))
        this.setData({messages:append?[...this.data.messages,...messages.filter(m=>!seen.has(m.id))]:messages,nextOffset:page.nextOffset})
      }catch(error){if(this.ready&&request===this.request)this.setData({error:error instanceof Error?error.message:'留言暂时没有加载成功'})}
      finally{if(this.ready&&request===this.request)this.setData({loading:false})}
    },
    retry(){return this.load()},
    more(){this.load(true)},
    input(e:WechatMiniprogram.Input){this.postKey='';this.setData({content:e.detail.value,editorError:''})},
    async post(){
      if(this.properties.visitorPreview||this.data.posting||!this.properties.user)return
      const content=this.data.content.trim(),error=validateGuestbookContent(content)
      if(error){this.setData({editorError:error});return}
      const user=this.properties.user,key=this.postKey||(this.postKey=requestId())
      this.setData({posting:true,editorError:''})
      try{
        await postGuestbookMessage(user,content,key)
        if(!this.ready||user!==this.properties.user)return
        this.postKey='';this.setData({content:''});await this.load();wx.showToast({title:'留言已留下',icon:'none'})
      }catch(error){if(this.ready&&user===this.properties.user)this.setData({editorError:showError(error)})}
      finally{if(this.ready)this.setData({posting:false})}
    },
    async remove(e:WechatMiniprogram.TouchEvent){
      if(this.properties.visitorPreview||this.data.deleting||this.data.posting)return
      const message=this.data.messages.find(m=>m.id===e.currentTarget.dataset.id&&m.canDelete)
      if(!message)return
      const user=this.properties.user,result=await wx.showModal({title:'删除这条留言？',content:'删除后，留言会从这块留言板移除。',confirmText:'删除留言',confirmColor:'#a66b55'})
      if(!result.confirm||!this.ready||user!==this.properties.user)return
      this.setData({deleting:message.id})
      try{await deleteGuestbookMessage(user,message.id);if(this.ready&&user===this.properties.user)await this.load()}
      catch(error){if(this.ready)this.setData({error:showError(error)})}finally{if(this.ready)this.setData({deleting:''})}
    },
    showAuthor(e:WechatMiniprogram.TouchEvent){const message=this.data.messages.find(m=>m.id===e.currentTarget.dataset.id);if(message)this.setData({author:message.author})},
    closeAuthor(){this.setData({author:null})},
    authorHome(){const author=this.data.author;if(!author)return;this.setData({author:null});wx.navigateTo({url:'/pages/profile/profile?user='+encodeURIComponent(author.id)+(this.properties.visitorPreview?'&preview=1':''),fail:()=>wx.showToast({title:'页面较多，请先返回上一页再试',icon:'none'})})},
    stopTap(){},
  },
})
