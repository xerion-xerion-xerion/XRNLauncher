package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.gen.Accessor;import net.minecraft.client.model.geom.builders.*;
@Mixin(LayerDefinition.class)public interface CapeLayerDataAccessor {@Accessor("mesh") MeshDefinition xrn$data();}
