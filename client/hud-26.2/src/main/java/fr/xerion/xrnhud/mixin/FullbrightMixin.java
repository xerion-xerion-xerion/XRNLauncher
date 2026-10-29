package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Eclairage;import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import net.minecraft.client.renderer.LightmapRenderStateExtractor;import net.minecraft.client.renderer.state.LightmapRenderState;
@Mixin(LightmapRenderStateExtractor.class)
public abstract class FullbrightMixin {
 @Shadow private boolean needsUpdate;@Unique private boolean xrn$previous;
 @Inject(method="extract",at=@At("HEAD"),require=1)private void xrn$changed(LightmapRenderState state,float dt,CallbackInfo ci){boolean active=Eclairage.actif();if(active!=xrn$previous){needsUpdate=true;xrn$previous=active;}}
 @Inject(method="extract",at=@At("TAIL"),require=1)private void xrn$light(LightmapRenderState state,float dt,CallbackInfo ci){if(Eclairage.actif()){state.nightVisionEffectIntensity=1;state.nightVisionColor=new org.joml.Vector3f(1);}}
}
