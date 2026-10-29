package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
@Mixin(net.minecraft.client.gui.components.AbstractButton.class)
public class MenuButtonMixin {
    @Inject(method="extractDefaultSprite",at=@At("HEAD"),cancellable=true)
    private void xrn$button(net.minecraft.client.gui.GuiGraphicsExtractor c,CallbackInfo ci){
        if(!fr.xerion.xrnhud.StyleMenus.actif())return;
        var b=(net.minecraft.client.gui.components.AbstractWidget)(Object)this;
        fr.xerion.xrnhud.StyleMenus.fond(c,b.getX(),b.getY(),b.getWidth(),b.getHeight(),b.isHoveredOrFocused(),b.active);
        ci.cancel();
    }
}
