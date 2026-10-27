package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Visuels;
import net.minecraft.client.render.WorldRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(WorldRenderer.class)
public class BlockOutlineMixin {
    @ModifyVariable(method="drawBlockOutline",at=@At("HEAD"),argsOnly=true,ordinal=0,require=1)
    private int xrn$color(int original){return Visuels.contours?Visuels.blockColor:original;}
    @ModifyVariable(method="drawBlockOutline",at=@At("HEAD"),argsOnly=true,ordinal=0,require=1)
    private float xrn$width(float original){return Visuels.contours?Visuels.blockWidth:original;}
}
