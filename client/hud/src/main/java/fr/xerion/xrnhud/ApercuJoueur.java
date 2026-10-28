package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.util.Identifier;
/** A fresh render state of the current player. Never mutates their skin, pose or equipped cosmetic. */
final class ApercuJoueur {
 static int renders;
 static void dessiner(DrawContext c,int x,int y,int w,int h,float angle,String cape){
  MinecraftClient mc=MinecraftClient.getInstance();if(mc.player==null)return;
  var renderer=(PlayerEntityRenderer)mc.getEntityRenderDispatcher().getRenderer(mc.player);
  var state=new PlayerEntityRenderState();renderer.updateRenderState(mc.player,state,1f);
  state.light=15728880;state.outlineColor=0;state.shadowPieces.clear();state.displayName=null;
  state.bodyYaw=180;state.relativeHeadYaw=0;state.pitch=0;state.limbSwingAmplitude=0;state.limbSwingAnimationProgress=0;
  state.isInSneakingPose=false;state.isGliding=false;state.isSwimming=false;state.pose=net.minecraft.entity.EntityPose.STANDING;
  state.equippedHeadStack=net.minecraft.item.ItemStack.EMPTY;state.equippedChestStack=net.minecraft.item.ItemStack.EMPTY;state.equippedLegsStack=net.minecraft.item.ItemStack.EMPTY;state.equippedFeetStack=net.minecraft.item.ItemStack.EMPTY;
  state.field_53536=6;state.field_53537=0;state.field_53538=0;
  var skin=state.skinTextures;Identifier texture=Droits.texture(cape);
  if(skin!=null)state.skinTextures=new net.minecraft.entity.player.SkinTextures(skin.body(),texture==null?null:new Cape(texture),skin.elytra(),skin.model(),skin.secure());
  state.capeVisible=texture!=null;
  c.addEntity(state,(h-14)/2.15f,new org.joml.Vector3f(0,state.height/2+.04f,0),new org.joml.Quaternionf().rotateZ((float)Math.PI).rotateY((float)Math.toRadians(angle)),new org.joml.Quaternionf(),x,y,x+w,y+h);
  renders++;
 }
 private record Cape(Identifier chemin) implements net.minecraft.util.AssetInfo.TextureAsset {
  public Identifier id(){return chemin;}public Identifier texturePath(){return chemin;}
 }
}
