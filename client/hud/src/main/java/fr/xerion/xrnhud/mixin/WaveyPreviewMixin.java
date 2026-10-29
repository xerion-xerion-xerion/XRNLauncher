package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import net.minecraft.client.render.entity.model.PlayerCapeModel;import net.minecraft.client.render.entity.state.PlayerEntityRenderState;import net.minecraft.client.util.math.MatrixStack;import net.minecraft.client.render.command.OrderedRenderCommandQueue;import net.minecraft.client.render.RenderLayers;import net.minecraft.client.render.OverlayTexture;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
/** Optional interoperability only. No WaveyCapes implementation or binaries are bundled. */
@Pseudo @Mixin(targets="dev.tr7zw.waveycapes.renderlayers.CustomCapeRenderLayer",remap=false)
public abstract class WaveyPreviewMixin {
 @Unique private PlayerCapeModel xrn$previewModel;
 @Inject(method="submit(Lnet/minecraft/class_4587;Lnet/minecraft/class_11659;ILnet/minecraft/class_10055;FF)V",at=@At("HEAD"),cancellable=true,remap=false,require=0)
 private void xrn$preview(MatrixStack matrices,OrderedRenderCommandQueue queue,int light,PlayerEntityRenderState state,float yaw,float pitch,CallbackInfo ci){
  if((!((CapeApercu)(Object)state).xrn$apercuCape()&&CapeMouvement.actif)||state.skinTextures==null||state.skinTextures.cape()==null)return;
  if(xrn$previewModel==null)xrn$previewModel=new PlayerCapeModel(PlayerCapeModel.getTexturedModelData().createModel());
  queue.submitModel(xrn$previewModel,state,matrices,RenderLayers.entitySolid(state.skinTextures.cape().texturePath()),light,OverlayTexture.DEFAULT_UV,state.outlineColor,null);CapeMouvement.apercusWavey++;ci.cancel();
 }
}
