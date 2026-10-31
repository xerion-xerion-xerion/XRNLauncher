package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(net.minecraft.client.render.CloudRenderer.class) public abstract class CielCloudMixin {
 @Inject(method="renderClouds",at=@At("HEAD"),cancellable=true,require=1)private void xrn$panoramaClouds(CallbackInfo ci){if(fr.xerion.xrnhud.Ciel.disponible())ci.cancel();}
}
