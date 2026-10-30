package fr.xerion.xrnhud.mixin;
import java.util.LinkedHashMap;import fr.xerion.xrnhud.CapeApercu;import net.minecraft.client.render.entity.feature.CapeFeatureRenderer;import net.minecraft.client.render.entity.model.*;import net.minecraft.client.render.entity.state.PlayerEntityRenderState;import net.minecraft.client.util.math.MatrixStack;import net.minecraft.client.render.command.OrderedRenderCommandQueue;import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(CapeFeatureRenderer.class)public abstract class CapeModelIsolationMixin {
 @Shadow @Final @Mutable private BipedEntityModel<PlayerEntityRenderState> model;@Unique private BipedEntityModel<PlayerEntityRenderState> xrn$normal;@Unique private final LinkedHashMap<Long,PlayerCapeModel> xrn$models=new LinkedHashMap<>(32,.75f,true);
 @Inject(method="render(Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;ILnet/minecraft/client/render/entity/state/PlayerEntityRenderState;FF)V",at=@At("HEAD"),require=1)
 private void xrn$choose(MatrixStack matrices,OrderedRenderCommandQueue collector,int light,PlayerEntityRenderState state,float yaw,float pitch,CallbackInfo ci){
  if(xrn$normal==null)xrn$normal=model;boolean ours=state.skinTextures!=null&&state.skinTextures.cape()!=null&&state.skinTextures.cape().texturePath().getNamespace().equals("xrnhud");if(!ours){model=xrn$normal;return;}
  long key=((long)state.id<<1)|(((CapeApercu)(Object)state).xrn$apercuCape()?1:0);model=xrn$models.computeIfAbsent(key,k->new PlayerCapeModel(PlayerCapeModel.getTexturedModelData().createModel()));while(xrn$models.size()>256)xrn$models.remove(xrn$models.keySet().iterator().next());
 }
}
