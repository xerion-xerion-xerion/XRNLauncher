package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.gen.Accessor;import net.minecraft.client.model.*;
@Mixin(TexturedModelData.class)public interface CapeLayerDataAccessor {@Accessor("data") ModelData xrn$data();}
