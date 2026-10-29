package fr.xerion.xrnhud.mixin;
import java.util.Map;import java.util.List;import net.minecraft.client.model.ModelPart;import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(ModelPart.class)
public interface CapePartsAccessor {
 @Accessor("children") Map<String,ModelPart> xrn$children();
 @Accessor("cuboids") List<ModelPart.Cuboid> xrn$cubes();
}
