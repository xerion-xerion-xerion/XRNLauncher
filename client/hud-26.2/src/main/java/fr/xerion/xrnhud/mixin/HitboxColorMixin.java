package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Visuels;
import net.minecraft.client.renderer.debug.EntityHitboxDebugRenderer;
import net.minecraft.gizmos.GizmoStyle;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(EntityHitboxDebugRenderer.class)
public class HitboxColorMixin {
    @Redirect(method="showHitboxes",at=@At(value="INVOKE",target="Lnet/minecraft/gizmos/GizmoStyle;stroke(I)Lnet/minecraft/gizmos/GizmoStyle;"),require=1)
    private GizmoStyle xrn$style(int color){return Visuels.hitboxes?GizmoStyle.stroke(Visuels.hitColor,Visuels.hitWidth):GizmoStyle.stroke(color);}
}
