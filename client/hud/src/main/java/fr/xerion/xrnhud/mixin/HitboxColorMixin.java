package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Visuels;
import net.minecraft.client.render.DrawStyle;
import net.minecraft.client.render.debug.EntityHitboxDebugRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(EntityHitboxDebugRenderer.class)
public class HitboxColorMixin {
    @Redirect(method="drawHitbox",at=@At(value="INVOKE",target="Lnet/minecraft/client/render/DrawStyle;stroked(I)Lnet/minecraft/client/render/DrawStyle;"),require=1)
    private DrawStyle xrn$style(int color){return Visuels.hitboxes?DrawStyle.stroked(Visuels.hitColor,Visuels.hitWidth):DrawStyle.stroked(color);}
}
