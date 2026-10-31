package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.*;import fr.xerion.xrnhud.DroppedItemScale;
@Mixin(net.minecraft.client.render.entity.state.ItemEntityRenderState.class) public abstract class DroppedItemStateMixin implements DroppedItemScale {@Unique private float xrn$scale=1;public float xrn$dropScale(){return xrn$scale;}public void xrn$dropScale(float value){xrn$scale=value;}}
