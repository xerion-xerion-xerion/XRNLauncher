package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Eclairage;import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import net.minecraft.client.renderer.Lightmap;import net.minecraft.client.renderer.state.LightmapRenderState;import com.mojang.blaze3d.textures.GpuTexture;import com.mojang.blaze3d.systems.RenderSystem;
@Mixin(Lightmap.class)
public abstract class FullbrightMixin {
 @Shadow @Final private GpuTexture texture;@Unique private boolean xrn$white;
 @Inject(method="render",at=@At("HEAD"),cancellable=true,require=1)
 private void xrn$light(LightmapRenderState state,CallbackInfo ci){
  if(Eclairage.actif()){if(!xrn$white||state.needsUpdate)RenderSystem.getDevice().createCommandEncoder().clearColorTexture(texture,new org.joml.Vector4f(1));xrn$white=true;ci.cancel();}
  else if(xrn$white){state.needsUpdate=true;xrn$white=false;}
 }
}
