package fr.xerion.xrnhud;
import java.lang.reflect.Method;import net.minecraft.util.Identifier;
/** Adapts XRN square cape atlases to the upstream renderer's UV-sheet metadata. */
public final class WaveyIntegration {
 public static int correctedFrames;
 private static final ClassValue<Method> texture=new ClassValue<>(){protected Method computeValue(Class<?> c){try{return c.getMethod("getCapeTexture");}catch(ReflectiveOperationException e){throw new IllegalStateException(e);}}};
 private static final ClassValue<Method> height=new ClassValue<>(){protected Method computeValue(Class<?> c){try{return c.getMethod("uvSheetHeight");}catch(ReflectiveOperationException e){throw new IllegalStateException(e);}}};
 public static int sheetHeight(Object renderer,Object player){try{Object cape=texture.get(player.getClass()).invoke(player);if(cape instanceof Identifier id&&id.getNamespace().equals("xrnhud")){correctedFrames++;return 64;}return (int)height.get(renderer.getClass()).invoke(renderer);}catch(ReflectiveOperationException e){return 32;}}
}
