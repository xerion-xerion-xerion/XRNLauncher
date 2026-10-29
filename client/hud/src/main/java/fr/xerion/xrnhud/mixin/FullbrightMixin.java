package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Eclairage;import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import net.minecraft.client.render.LightmapTextureManager;import com.mojang.blaze3d.textures.GpuTexture;import com.mojang.blaze3d.systems.RenderSystem;
/** Maximum white lightmap; independent of night vision, gamma and world brightness. */
@Mixin(LightmapTextureManager.class)
public abstract class FullbrightMixin {
 @Shadow @Final private GpuTexture glTexture;@Shadow private boolean dirty;@Unique private boolean xrn$white;
 @Inject(method="update",at=@At("HEAD"),cancellable=true,require=1)
 private void xrn$light(float dt,CallbackInfo ci){
  if(Eclairage.actif()){if(!xrn$white||dirty)RenderSystem.getDevice().createCommandEncoder().clearColorTexture(glTexture,0xFFFFFFFF);xrn$white=true;dirty=false;ci.cancel();}
  else if(xrn$white){dirty=true;xrn$white=false;}
 }
}
