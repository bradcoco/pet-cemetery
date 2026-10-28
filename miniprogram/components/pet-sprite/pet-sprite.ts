Component({
  properties: { emoji:{type:String,value:''}, paused: {type:Boolean,value:false}, species: {type:String,value:'猫咪'}, walking: {type:Boolean,value:false}, happy: {type:Boolean,value:false}, facing: {type:Number,value:1} },
  data: {kind:'cat'},
  observers: { species(species: string) { this.setData({kind:species==='狗狗'?'dog':species==='兔兔'?'rabbit':species==='鸟儿'?'bird':species==='猫咪'?'cat':'other'}) } },
})
