package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.util.Identifier;
/** A fresh render state of the current player. Never mutates their skin, pose or equipped cosmetic. */
final class ApercuJoueur {
 static int renders;private static java.util.UUID profileId;private static java.util.function.Supplier<net.minecraft.entity.player.SkinTextures> lookup;
 static void dessiner(DrawContext c,int x,int y,int w,int h,float angle,String cape){
  MinecraftClient mc=MinecraftClient.getInstance();var state=new PlayerEntityRenderState();
  if(mc.player!=null){var renderer=(PlayerEntityRenderer)mc.getEntityRenderDispatcher().getRenderer(mc.player);renderer.updateRenderState(mc.player,state,1f);}else{
   var profile=mc.getGameProfile();if(lookup==null||!profile.id().equals(profileId)){profileId=profile.id();lookup=mc.getSkinProvider().supplySkinTextures(profile,false);}state.skinTextures=lookup.get();state.entityType=net.minecraft.entity.EntityType.PLAYER;state.height=1.8f;state.width=.6f;state.hatVisible=state.jacketVisible=state.leftPantsLegVisible=state.rightPantsLegVisible=state.leftSleeveVisible=state.rightSleeveVisible=true;
  }
  if(mc.player==null)state.age=(System.nanoTime()/50_000_000L)%12000;
  ((CapeApercu)(Object)state).xrn$apercuCape(true);
  state.light=15728880;state.outlineColor=0;state.shadowPieces.clear();state.displayName=null;
  state.bodyYaw=180;state.relativeHeadYaw=0;state.pitch=0;state.limbSwingAmplitude=0;state.limbSwingAnimationProgress=0;
  state.isInSneakingPose=false;state.isGliding=false;state.isSwimming=false;state.pose=net.minecraft.entity.EntityPose.STANDING;
  state.equippedHeadStack=net.minecraft.item.ItemStack.EMPTY;state.equippedChestStack=net.minecraft.item.ItemStack.EMPTY;state.equippedLegsStack=net.minecraft.item.ItemStack.EMPTY;state.equippedFeetStack=net.minecraft.item.ItemStack.EMPTY;
  state.rightHandItemState.clear();state.leftHandItemState.clear();state.rightHandItem=net.minecraft.item.ItemStack.EMPTY;state.leftHandItem=net.minecraft.item.ItemStack.EMPTY;state.rightArmPose=net.minecraft.client.render.entity.model.BipedEntityModel.ArmPose.EMPTY;state.leftArmPose=net.minecraft.client.render.entity.model.BipedEntityModel.ArmPose.EMPTY;state.isUsingItem=false;state.handSwingProgress=0;
  state.field_53536=6;state.field_53537=0;state.field_53538=0;
  var skin=state.skinTextures;Identifier texture=Droits.texture(cape);
  if(skin!=null)state.skinTextures=new net.minecraft.entity.player.SkinTextures(skin.body(),texture==null?null:new Cape(texture),skin.elytra(),skin.model(),skin.secure());
  state.capeVisible=texture!=null;
  c.addEntity(state,(h-8)/1.95f,new org.joml.Vector3f(0,state.height/2+.04f,0),new org.joml.Quaternionf().rotateZ((float)Math.PI).rotateY((float)Math.toRadians(angle)),new org.joml.Quaternionf(),x,y,x+w,y+h);
  renders++;
 }
 static void tete(DrawContext c,int x,int y,int size){var mc=MinecraftClient.getInstance();var profile=mc.getGameProfile();if(lookup==null||!profile.id().equals(profileId)){profileId=profile.id();lookup=mc.getSkinProvider().supplySkinTextures(profile,false);}var skin=lookup.get();if(skin==null)return;var id=skin.body().texturePath();c.drawTexture(net.minecraft.client.gl.RenderPipelines.GUI_TEXTURED,id,x,y,8f,8f,size,size,8,8,64,64);c.drawTexture(net.minecraft.client.gl.RenderPipelines.GUI_TEXTURED,id,x,y,40f,8f,size,size,8,8,64,64);}
 private record Cape(Identifier chemin) implements net.minecraft.util.AssetInfo.TextureAsset {
  public Identifier id(){return chemin;}public Identifier texturePath(){return chemin;}
 }
}
