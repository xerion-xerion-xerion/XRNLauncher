package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.FreeLook;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(Entity.class)
public class FreeLookEntityMixin {
 @Inject(method="changeLookDirection",at=@At("HEAD"),cancellable=true,require=1)
 private void xrn$orbit(double dx,double dy,CallbackInfo ci){
  if(FreeLook.active()&&(Object)this==MinecraftClient.getInstance().player){FreeLook.rotate(dx,dy);ci.cancel();}
 }
}
