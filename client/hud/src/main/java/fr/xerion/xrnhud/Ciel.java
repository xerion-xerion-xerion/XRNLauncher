package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;import net.minecraft.client.texture.AbstractTexture;import net.minecraft.util.Identifier;import com.google.gson.JsonObject;
public final class Ciel {
 public static boolean actif=false,astres=true,anime=true,effets=true,ambiance=false;
 public static float vitesse=1,volume=.2f;private static double temps;private static long dernier;
 public static double temps(){return temps;}
 public static org.joml.Matrix4f matrice(org.joml.Matrix4fc original){return new org.joml.Matrix4f(original).rotateY((float)(temps*(mode==0?.008:.014))).rotateX(effets?(float)(Math.sin(temps*.035)*.012):0);}

 public static float luminosite=1f;public static int mode;public static String nom(){return mode==0?"Nebuleuse":"Nuages lilas";}public static int teinte=0xFFFFFFFF;
 public static org.joml.Vector4f couleur(){float pulse=effets&&anime?(float)(.96+.04*Math.sin(temps*.45)):1;return new org.joml.Vector4f((teinte>>16&255)/255f*luminosite*pulse,(teinte>>8&255)/255f*luminosite*(effets&&anime?(float)(.97+.03*Math.sin(temps*.38+.6)):1),(teinte&255)/255f*luminosite,1f);}

 public static boolean disponible(){var cl=MinecraftClient.getInstance();if(!actif||cl.world==null||!cl.world.getRegistryKey().getValue().toString().equals("minecraft:overworld"))return false;
  if(net.fabricmc.loader.api.FabricLoader.getInstance().isModLoaded("iris")){try{var type=Class.forName("net.irisshaders.iris.api.v0.IrisApi");if((boolean)type.getMethod("isShaderPackInUse").invoke(type.getMethod("getInstance").invoke(null)))return false;}catch(ReflectiveOperationException|LinkageError ignored){return false;}}return true;}
 private static AbstractTexture prepared;
 public static void preparer(){long now=System.nanoTime();if(dernier!=0&&anime&&!net.minecraft.client.MinecraftClient.getInstance().isPaused())temps+=Math.min(.1,(now-dernier)/1e9)*vitesse;dernier=now;prepared= MinecraftClient.getInstance().getTextureManager().getTexture(Identifier.of("xrnhud","textures/environment/"+(mode==0?"nebula.png":"clouds.png")));}
 public static AbstractTexture texture(){return prepared;}
 public static final int INDICES=32*16*6;
 public static com.mojang.blaze3d.buffers.GpuBuffer creerBuffer(){
  try(var memory=net.minecraft.client.util.BufferAllocator.fixedSized(32*16*4*net.minecraft.client.render.VertexFormats.POSITION_TEXTURE_COLOR.getVertexSize())){
   var b=new net.minecraft.client.render.BufferBuilder(memory,com.mojang.blaze3d.vertex.VertexFormat.DrawMode.QUADS,net.minecraft.client.render.VertexFormats.POSITION_TEXTURE_COLOR);
   for(int y=0;y<16;y++)for(int x=0;x<32;x++){point(b,x,y);point(b,x,y+1);point(b,x+1,y+1);point(b,x+1,y);}
   try(var mesh=b.end()){return com.mojang.blaze3d.systems.RenderSystem.getDevice().createBuffer(()->"XRN sky dome",com.mojang.blaze3d.buffers.GpuBuffer.USAGE_VERTEX,mesh.getBuffer());}
  }
 }
 private static void point(net.minecraft.client.render.BufferBuilder b,int x,int y){
  double u=x/32.0,v=y/16.0,theta=v*Math.PI,phi=u*Math.PI*2;
  float tx=(float)(.5+((u<=.5?u*2:(1-u)*2)-.5)*Math.sin(theta));
  // Mirrored horizontal mapping meets continuously at both meridians.
  b.vertex((float)(Math.sin(theta)*Math.cos(phi)*100),(float)(Math.cos(theta)*100),(float)(Math.sin(theta)*Math.sin(phi)*100)).texture(tx,(float)v).color(0xFFFFFFFF);
 }
 static void charger(JsonObject o){if(o.has("skyAnimated"))anime=o.get("skyAnimated").getAsBoolean();if(o.has("skyEffects"))effets=o.get("skyEffects").getAsBoolean();if(o.has("skyAmbience"))ambiance=o.get("skyAmbience").getAsBoolean();if(o.has("skySpeed"))vitesse=(float)Math.clamp(o.get("skySpeed").getAsDouble(),.25,3);if(o.has("skyVolume"))volume=(float)Math.clamp(o.get("skyVolume").getAsDouble(),0,1);if(o.has("skyMode"))mode=Math.clamp(o.get("skyMode").getAsInt(),0,1);if(o.has("skyBrightness"))luminosite=(float)Math.clamp(o.get("skyBrightness").getAsDouble(),.5,3);if(o.has("skyTint"))teinte=o.get("skyTint").getAsInt();if(o.has("skyCelestial"))astres=o.get("skyCelestial").getAsBoolean();if(o.has("skyXrn"))actif=o.get("skyXrn").getAsBoolean();}static void sauver(JsonObject o){o.addProperty("skyAnimated",anime);o.addProperty("skyEffects",effets);o.addProperty("skyAmbience",ambiance);o.addProperty("skySpeed",vitesse);o.addProperty("skyVolume",volume);o.addProperty("skyMode",mode);o.addProperty("skyBrightness",luminosite);o.addProperty("skyTint",teinte);o.addProperty("skyCelestial",astres);o.addProperty("skyXrn",actif);}
}
