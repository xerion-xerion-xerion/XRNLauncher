package fr.xerion.xrnhud.mixin;

import fr.xerion.xrnhud.Clics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import net.minecraft.client.input.MouseInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public class MouseMixin {
    @Inject(method="onMouseButton",at=@At("HEAD"),require=1)
    private void xrn$click(long window,MouseInput input,int action,CallbackInfo ci){
        MinecraftClient cl=MinecraftClient.getInstance();
        if(action==1&&window==cl.getWindow().getHandle()&&cl.player!=null&&cl.currentScreen==null)Clics.enregistrer(input.button());
    }
}
