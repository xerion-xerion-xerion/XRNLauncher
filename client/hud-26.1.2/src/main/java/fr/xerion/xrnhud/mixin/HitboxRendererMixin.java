package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Visuels;
import net.minecraft.client.gui.components.debug.DebugScreenEntries;
import net.minecraft.client.gui.components.debug.DebugScreenEntryList;
import net.minecraft.client.renderer.debug.DebugRenderer;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(DebugRenderer.class)
public class HitboxRendererMixin {
    @Redirect(method="refreshRendererList",at=@At(value="INVOKE",target="Lnet/minecraft/client/gui/components/debug/DebugScreenEntryList;isCurrentlyEnabled(Lnet/minecraft/resources/Identifier;)Z"),require=1)
    private boolean xrn$show(DebugScreenEntryList profile,Identifier entry){return profile.isCurrentlyEnabled(entry)||(Visuels.hitboxes&&entry.equals(DebugScreenEntries.ENTITY_HITBOXES));}
}
