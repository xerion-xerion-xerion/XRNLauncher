package fr.xerion.xrnhud;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.resources.Identifier;
/** A fresh render state of the current player. Never mutates their skin, pose or equipped cosmetic. */
final class ApercuJoueur {
 static int renders;private static java.util.UUID profileId;private static java.util.function.Supplier<net.minecraft.world.entity.player.PlayerSkin> lookup;
 static void dessiner(GuiGraphicsExtractor c,int x,int y,int w,int h,float angle,String cape){
  Minecraft mc=Minecraft.getInstance();var state=new AvatarRenderState();
  if(mc.player!=null){var renderer=(AvatarRenderer)mc.getEntityRenderDispatcher().getRenderer(mc.player);renderer.extractRenderState(mc.player,state,1f);}else{
   var profile=mc.getGameProfile();if(lookup==null||!profile.id().equals(profileId)){profileId=profile.id();lookup=mc.getSkinManager().createLookup(profile,false);}state.skin=lookup.get();state.entityType=net.minecraft.world.entity.EntityTypes.PLAYER;state.boundingBoxHeight=1.8f;state.boundingBoxWidth=.6f;
  }
  if(mc.player==null)state.ageInTicks=(System.nanoTime()/50_000_000L)%12000;
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
  c.entity(state,(h-8)/1.95f,new org.joml.Vector3f(0,state.boundingBoxHeight/2+.04f,0),new org.joml.Quaternionf().rotateZ((float)Math.PI).rotateY((float)Math.toRadians(angle)),new org.joml.Quaternionf(),x,y,x+w,y+h);
  renders++;
 }
 static void tete(GuiGraphicsExtractor c,int x,int y,int size){var mc=Minecraft.getInstance();var profile=mc.getGameProfile();if(lookup==null||!profile.id().equals(profileId)){profileId=profile.id();lookup=mc.getSkinManager().createLookup(profile,false);}var skin=lookup.get();if(skin==null)return;var id=skin.body().texturePath();c.blit(net.minecraft.client.renderer.RenderPipelines.GUI_TEXTURED,id,x,y,8f,8f,size,size,8,8,64,64);c.blit(net.minecraft.client.renderer.RenderPipelines.GUI_TEXTURED,id,x,y,40f,8f,size,size,8,8,64,64);}
 private record Cape(Identifier chemin) implements net.minecraft.core.ClientAsset.Texture {
  public Identifier id(){return chemin;}public Identifier texturePath(){return chemin;}
 }
}
