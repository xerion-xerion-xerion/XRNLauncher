package fr.xerion.xrnhud;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.resources.Identifier;
/** A fresh render state of the current player. Never mutates their skin, pose or equipped cosmetic. */
final class ApercuJoueur {
 static int renders;
 static void dessiner(GuiGraphicsExtractor c,int x,int y,int w,int h,float angle,String cape){
  Minecraft mc=Minecraft.getInstance();if(mc.player==null)return;
  var renderer=(AvatarRenderer)mc.getEntityRenderDispatcher().getRenderer(mc.player);
  var state=new AvatarRenderState();renderer.extractRenderState(mc.player,state,1f);
  ((CapeApercu)(Object)state).xrn$apercuCape(true);
  state.lightCoords=15728880;state.outlineColor=0;state.shadowPieces.clear();state.nameTag=null;
  state.bodyRot=180;state.yRot=0;state.xRot=0;state.walkAnimationSpeed=0;state.walkAnimationPos=0;
  state.isCrouching=false;state.isFallFlying=false;state.isVisuallySwimming=false;state.pose=net.minecraft.world.entity.Pose.STANDING;
  state.headEquipment=net.minecraft.world.item.ItemStack.EMPTY;state.chestEquipment=net.minecraft.world.item.ItemStack.EMPTY;state.legsEquipment=net.minecraft.world.item.ItemStack.EMPTY;state.feetEquipment=net.minecraft.world.item.ItemStack.EMPTY;
  state.rightHandItemState.clear();state.leftHandItemState.clear();state.rightHandItemStack=net.minecraft.world.item.ItemStack.EMPTY;state.leftHandItemStack=net.minecraft.world.item.ItemStack.EMPTY;state.rightArmPose=net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;state.leftArmPose=net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;state.isUsingItem=false;state.attackTime=0;
  state.capeFlap=6;state.capeLean=0;state.capeLean2=0;
  var skin=state.skin;Identifier texture=Droits.texture(cape);
  if(skin!=null)state.skin=new net.minecraft.world.entity.player.PlayerSkin(skin.body(),texture==null?null:new Cape(texture),skin.elytra(),skin.model(),skin.secure());
  state.showCape=texture!=null;
  c.entity(state,(h-14)/2.15f,new org.joml.Vector3f(0,state.boundingBoxHeight/2+.04f,0),new org.joml.Quaternionf().rotateZ((float)Math.PI).rotateY((float)Math.toRadians(angle)),new org.joml.Quaternionf(),x,y,x+w,y+h);
  renders++;
 }
 private record Cape(Identifier chemin) implements net.minecraft.core.ClientAsset.Texture {
  public Identifier id(){return chemin;}public Identifier texturePath(){return chemin;}
 }
}
