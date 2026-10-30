package fr.xerion.xrnhud.mixin;
import java.util.LinkedHashMap;import fr.xerion.xrnhud.CapeApercu;import net.minecraft.client.renderer.entity.layers.CapeLayer;import net.minecraft.client.model.*;import net.minecraft.client.model.player.PlayerCapeModel;import net.minecraft.client.renderer.entity.state.AvatarRenderState;import com.mojang.blaze3d.vertex.PoseStack;import net.minecraft.client.renderer.SubmitNodeCollector;import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(CapeLayer.class)public abstract class CapeModelIsolationMixin {
 @Shadow @Final @Mutable private HumanoidModel<AvatarRenderState> model;@Unique private HumanoidModel<AvatarRenderState> xrn$normal;@Unique private final LinkedHashMap<Long,PlayerCapeModel> xrn$models=new LinkedHashMap<>(32,.75f,true);
 @Inject(method="submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/AvatarRenderState;FF)V",at=@At("HEAD"),require=1)
 private void xrn$choose(PoseStack matrices,SubmitNodeCollector collector,int light,AvatarRenderState state,float yaw,float pitch,CallbackInfo ci){
  if(xrn$normal==null)xrn$normal=model;boolean ours=state.skin!=null&&state.skin.cape()!=null&&state.skin.cape().texturePath().getNamespace().equals("xrnhud");if(!ours){model=xrn$normal;return;}
  long key=((long)state.id<<1)|(((CapeApercu)(Object)state).xrn$apercuCape()?1:0);model=xrn$models.computeIfAbsent(key,k->new PlayerCapeModel(PlayerCapeModel.createCapeLayer().bakeRoot()));while(xrn$models.size()>256)xrn$models.remove(xrn$models.keySet().iterator().next());
 }
}
