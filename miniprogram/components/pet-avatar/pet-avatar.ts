import { defaultPetEmoji } from '../../utils/avatars'
Component({
  properties:{src:{type:String,value:''},emoji:{type:String,value:''},species:{type:String,value:'其他'}},
  data:{symbol:'🐾'},
  observers:{'emoji,species':function(emoji:string,species:string){this.setData({symbol:emoji||defaultPetEmoji(species)})}},
})
