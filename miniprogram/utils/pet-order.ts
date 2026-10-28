import { Memorial, ownPets, PetFilter } from './model'

export function validatePetOrder(order: string[]): string {
  return !Array.isArray(order) || order.length > 10000 || order.some(id=>typeof id!=='string'||!/^[\w-]{1,100}$/.test(id)) || new Set(order).size!==order.length ? '宠物排序不正确，请重新调整' : ''
}
export function orderedPets(records: Memorial[], order: string[]): Memorial[] {
  const rank=new Map(order.map((id,i)=>[id,i]))
  return ownPets(records).sort((a,b)=>{const left=rank.get(a.id),right=rank.get(b.id);return (left!=null?left:order.length)-(right!=null?right:order.length)})
}
export function movePetOrder(records: Memorial[], filter: PetFilter, id: string, direction: number): string[] {
  const visible=ownPets(records,filter), index=visible.findIndex(p=>p.id===id), neighbor=visible[index+direction], result=records.map(p=>p.id)
  if(index<0||!neighbor||![-1,1].includes(direction))return result
  const a=result.indexOf(id),b=result.indexOf(neighbor.id)
  const previous=result[a];result[a]=result[b];result[b]=previous
  return result
}
