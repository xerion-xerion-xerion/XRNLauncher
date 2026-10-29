package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.CapeApercu;import net.minecraft.client.render.entity.state.PlayerEntityRenderState;import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.Unique;
@Mixin(PlayerEntityRenderState.class)
public abstract class CapePreviewMixin implements CapeApercu {
 @Unique private boolean xrn$previewCape;
 public boolean xrn$apercuCape(){return xrn$previewCape;}public void xrn$apercuCape(boolean value){xrn$previewCape=value;}
}
