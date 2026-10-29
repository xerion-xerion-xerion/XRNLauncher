package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import fr.xerion.xrnhud.TailleObjets;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.Level;
import net.minecraft.world.item.ItemStack;
@Mixin(net.minecraft.client.gui.GuiGraphicsExtractor.class)
public abstract class ItemScaleGuiMixin {
 @Shadow public abstract org.joml.Matrix3x2fStack pose();
 @Inject(method="item(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/level/Level;Lnet/minecraft/world/item/ItemStack;III)V",at=@At("HEAD"),require=1)
 private void xrn$scale(LivingEntity entity,Level level,ItemStack stack,int x,int y,int seed,CallbackInfo ci){float scale=TailleObjets.facteur(stack,true);var m=pose();m.pushMatrix();m.translate(x+8,y+8);m.scale(scale,scale);m.translate(-x-8,-y-8);}
 @Inject(method="item(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/level/Level;Lnet/minecraft/world/item/ItemStack;III)V",at=@At("RETURN"),require=1)
 private void xrn$restore(LivingEntity entity,Level level,ItemStack stack,int x,int y,int seed,CallbackInfo ci){pose().popMatrix();}
}
