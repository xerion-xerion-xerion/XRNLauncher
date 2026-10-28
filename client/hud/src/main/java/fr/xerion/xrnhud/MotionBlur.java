package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.textures.FilterMode;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.Framebuffer;
import net.minecraft.client.gl.SimpleFramebuffer;
import net.minecraft.client.gl.UniformType;
import net.minecraft.client.render.VertexFormats;
import com.mojang.blaze3d.vertex.VertexFormat;
import com.mojang.blaze3d.platform.DepthTestFunction;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** GPU-only temporal accumulation. The world is blended before the HUD is drawn. */
public final class MotionBlur {
 public static boolean enabled;
 public static int intensity=35;
 private static boolean failed;
 private static Framebuffer previous,next;
 private static GpuBuffer uniform;
 private static Object lastWorld;
 private static long lastTime;
 private static boolean seeded;
 private static int appliedFrames;
 private static final ByteBuffer DATA=ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder());
 private static RenderPipeline pipeline;
 public static void init(){pipeline=makePipeline();}
 private static RenderPipeline makePipeline(){return fr.xerion.xrnhud.mixin.RenderPipelinesAccessor.xrn$register(RenderPipeline.builder()
  .withLocation(net.minecraft.util.Identifier.of("xrnhud","pipeline/motion_blur")).withVertexShader(net.minecraft.util.Identifier.of("xrnhud","core/motion_blur")).withFragmentShader(net.minecraft.util.Identifier.of("xrnhud","core/motion_blur"))
  .withSampler("CurrentSampler").withSampler("HistorySampler").withUniform("BlurData",UniformType.UNIFORM_BUFFER)
  .withDepthTestFunction(DepthTestFunction.NO_DEPTH_TEST).withDepthWrite(false).withCull(false).withoutBlend()
  .withVertexFormat(VertexFormats.EMPTY,VertexFormat.DrawMode.TRIANGLES).build());}
 public static void setEnabled(boolean value){enabled=value;failed=false;reset();}
 public static void setIntensity(int value){intensity=Math.clamp(value,0,100);}
 public static String status(){return failed?"Indisponible : consulter le journal":shaderActive()?"Suspendu : shader actif":enabled&&intensity>0?"Actif":"Inactif";}
 private static boolean shaderActive(){
  if(!net.fabricmc.loader.api.FabricLoader.getInstance().isModLoaded("iris"))return false;
  try{var type=Class.forName("net.irisshaders.iris.api.v0.IrisApi");return (boolean)type.getMethod("isShaderPackInUse").invoke(type.getMethod("getInstance").invoke(null));}
  catch(ReflectiveOperationException|LinkageError e){return true;}
 }
 public static int appliedFrames(){return appliedFrames;}
 public static void render(){
  var mc=MinecraftClient.getInstance();
  if(!enabled||intensity==0||failed||mc.world==null||mc.player==null||mc.currentScreen!=null||shaderActive()){reset();return;}
  var main=mc.getFramebuffer();var color=main.getColorAttachment();
  if(color==null)return;
  int w=color.getWidth(0),h=color.getHeight(0);if(w<=0||h<=0)return;
  long now=System.nanoTime();double seconds=lastTime==0?0:(now-lastTime)/1e9;
  try{
   if(previous==null||previous.textureWidth!=w||previous.textureHeight!=h||lastWorld!=mc.world){
    reset();previous=new SimpleFramebuffer("XRN motion history",w,h,false);next=new SimpleFramebuffer("XRN motion output",w,h,false);
    uniform=RenderSystem.getDevice().createBuffer(()->"XRN motion intensity",GpuBuffer.USAGE_UNIFORM|GpuBuffer.USAGE_COPY_DST,16L);lastWorld=mc.world;
   }
   var encoder=RenderSystem.getDevice().createCommandEncoder();
   if(!seeded||seconds<=0||seconds>.25){encoder.copyTextureToTexture(color,previous.getColorAttachment(),0,0,0,0,0,w,h);seeded=true;lastTime=now;return;}
   // Exponential decay makes the trail duration independent of the frame rate.
   float weight=(float)Math.exp(-seconds/(.001+intensity*.0007));
   DATA.clear();DATA.putFloat(weight).putFloat(0).putFloat(0).putFloat(0).flip();encoder.writeToBuffer(uniform.slice(),DATA);
   try(var pass=encoder.createRenderPass(()->"XRN Motion Blur",next.getColorAttachmentView(),java.util.OptionalInt.empty())){
    pass.setPipeline(pipeline);pass.setUniform("BlurData",uniform);
    pass.bindTexture("CurrentSampler",main.getColorAttachmentView(),RenderSystem.getSamplerCache().get(FilterMode.LINEAR));
    pass.bindTexture("HistorySampler",previous.getColorAttachmentView(),RenderSystem.getSamplerCache().get(FilterMode.LINEAR));
    pass.draw(0,3);
   }
   encoder.copyTextureToTexture(next.getColorAttachment(),color,0,0,0,0,0,w,h);
   var swap=previous;previous=next;next=swap;lastTime=now;appliedFrames++;
  }catch(RuntimeException|LinkageError e){failed=true;reset();org.slf4j.LoggerFactory.getLogger("XRN Motion Blur").warn("Motion Blur suspended: {}",e.toString());}
 }
 public static void reset(){if(previous!=null){previous.delete();previous=null;}if(next!=null){next.delete();next=null;}if(uniform!=null){uniform.close();uniform=null;}seeded=false;lastTime=0;lastWorld=null;}
 static void load(JsonObject o){enabled=o.has("motionBlur")&&o.get("motionBlur").getAsBoolean();if(o.has("motionBlurIntensity"))setIntensity(o.get("motionBlurIntensity").getAsInt());}
 static void save(JsonObject o){o.addProperty("motionBlur",enabled);o.addProperty("motionBlurIntensity",intensity);}
}
