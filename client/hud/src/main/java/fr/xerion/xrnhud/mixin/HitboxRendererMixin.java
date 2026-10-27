package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Visuels;
import net.minecraft.client.render.debug.DebugRenderer;
import net.minecraft.client.gui.hud.debug.DebugHudProfile;
import net.minecraft.client.gui.hud.debug.DebugHudEntries;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(DebugRenderer.class)
public class HitboxRendererMixin {
    @Redirect(method="initRenderers",at=@At(value="INVOKE",target="Lnet/minecraft/client/gui/hud/debug/DebugHudProfile;isEntryVisible(Lnet/minecraft/util/Identifier;)Z"),require=1)
    private boolean xrn$show(DebugHudProfile profile,Identifier entry){return profile.isEntryVisible(entry)||(Visuels.hitboxes&&entry.equals(DebugHudEntries.ENTITY_HITBOXES));}
}
