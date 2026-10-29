package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import net.minecraft.client.model.player.PlayerCapeModel;import net.minecraft.client.renderer.entity.state.AvatarRenderState;import com.mojang.blaze3d.vertex.PoseStack;import net.minecraft.client.renderer.SubmitNodeCollector;import net.minecraft.client.renderer.texture.OverlayTexture;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
/** Optional interoperability only. No WaveyCapes implementation or binaries are bundled. */
@Pseudo @Mixin(targets="dev.tr7zw.waveycapes.renderlayers.CustomCapeRenderLayer",remap=false)
public abstract class WaveyPreviewMixin {
 @Unique private PlayerCapeModel xrn$previewModel;
 @Inject(method="submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/AvatarRenderState;FF)V",at=@At("HEAD"),cancellable=true,remap=false,require=0)
 private void xrn$preview(PoseStack matrices,SubmitNodeCollector queue,int light,AvatarRenderState state,float yaw,float pitch,CallbackInfo ci){
  if((!((CapeApercu)(Object)state).xrn$apercuCape()&&CapeMouvement.actif)||state.skin==null||state.skin.cape()==null)return;
  if(xrn$previewModel==null)xrn$previewModel=new PlayerCapeModel(PlayerCapeModel.createCapeLayer().bakeRoot());
  queue.submitModel(xrn$previewModel,state,matrices,state.skin.cape().texturePath(),light,OverlayTexture.NO_OVERLAY,state.outlineColor,null);CapeMouvement.apercusWavey++;ci.cancel();
 }
}
