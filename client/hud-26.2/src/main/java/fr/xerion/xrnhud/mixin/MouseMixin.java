package fr.xerion.xrnhud.mixin;

import fr.xerion.xrnhud.Clics;
import net.minecraft.client.Minecraft;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.input.MouseButtonInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public class MouseMixin {
    @Inject(method="onButton",at=@At("HEAD"),require=1)
    private void xrn$click(long window,MouseButtonInfo input,int action,CallbackInfo ci){
        Minecraft cl=Minecraft.getInstance();
        if(action==1&&window==cl.getWindow().handle()&&cl.player!=null&&cl.gui.screen()==null)Clics.enregistrer(input.button());
    }
}
