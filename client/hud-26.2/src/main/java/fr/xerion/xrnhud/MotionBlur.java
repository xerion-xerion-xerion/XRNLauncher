package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.textures.FilterMode;
import net.minecraft.client.Minecraft;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.pipeline.TextureTarget;
import com.mojang.blaze3d.shaders.UniformType;



import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** GPU-only temporal accumulation. The world is blended before the HUD is drawn. */
public final class MotionBlur {
 public static boolean enabled;
 public static int intensity=35;
 private static boolean failed;
 private static RenderTarget previous,next;
 private static GpuBuffer uniform;
 private static Object lastWorld;
 private static long lastTime;
 private static boolean seeded;
 private static int appliedFrames;
 private static final ByteBuffer DATA=ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder());
 private static RenderPipeline pipeline;
 private static final java.util.Map<com.mojang.blaze3d.GpuFormat,RenderPipeline> PIPELINES=new java.util.EnumMap<>(com.mojang.blaze3d.GpuFormat.class);
 public static void init(){}
 private static RenderPipeline makePipeline(com.mojang.blaze3d.GpuFormat format){return fr.xerion.xrnhud.mixin.RenderPipelinesAccessor.xrn$register(RenderPipeline.builder()
  .withLocation(net.minecraft.resources.Identifier.fromNamespaceAndPath("xrnhud","pipeline/motion_blur_"+format.name().toLowerCase(java.util.Locale.ROOT))).withVertexShader(net.minecraft.resources.Identifier.fromNamespaceAndPath("xrnhud","core/motion_blur")).withFragmentShader(net.minecraft.resources.Identifier.fromNamespaceAndPath("xrnhud","core/motion_blur"))
  .withBindGroupLayout(com.mojang.blaze3d.pipeline.BindGroupLayout.builder().withSampler("CurrentSampler").withSampler("HistorySampler").withUniform("BlurData",UniformType.UNIFORM_BUFFER).build())
  .withColorTargetState(new com.mojang.blaze3d.pipeline.ColorTargetState(java.util.Optional.empty(),format,com.mojang.blaze3d.pipeline.ColorTargetState.WRITE_ALL))
  .withDepthStencilState(java.util.Optional.empty()).withCull(false).withPrimitiveTopology(com.mojang.blaze3d.PrimitiveTopology.TRIANGLES).build());}
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
  var mc=Minecraft.getInstance();
  if(!enabled||intensity==0||failed||mc.level==null||mc.player==null||mc.gui.screen()!=null||shaderActive()){reset();return;}
  var main=mc.gameRenderer.mainRenderTarget();var color=main.getColorTexture();
  if(color==null)return;
  int w=color.getWidth(0),h=color.getHeight(0);if(w<=0||h<=0)return;
  long now=System.nanoTime();double seconds=lastTime==0?0:(now-lastTime)/1e9;
  try{
   if(previous==null||previous.width!=w||previous.height!=h||previous.getColorTexture().getFormat()!=color.getFormat()||lastWorld!=mc.level){
    reset();pipeline=PIPELINES.computeIfAbsent(color.getFormat(),MotionBlur::makePipeline);previous=new TextureTarget("XRN motion history",w,h,false,color.getFormat());next=new TextureTarget("XRN motion output",w,h,false,color.getFormat());
    uniform=RenderSystem.getDevice().createBuffer(()->"XRN motion intensity",GpuBuffer.USAGE_UNIFORM|GpuBuffer.USAGE_COPY_DST,16L);lastWorld=mc.level;
   }
   var encoder=RenderSystem.getDevice().createCommandEncoder();
   if(!seeded||seconds<=0||seconds>.25){encoder.copyTextureToTexture(color,previous.getColorTexture(),0,0,0,0,0,w,h);seeded=true;lastTime=now;return;}
   // Exponential decay makes the trail duration independent of the frame rate.
   float weight=(float)Math.exp(-seconds/(.001+intensity*.0007));
   DATA.clear();DATA.putFloat(weight).putFloat(0).putFloat(0).putFloat(0).flip();encoder.writeToBuffer(uniform.slice(),DATA);
   try(var pass=encoder.createRenderPass(()->"XRN Motion Blur",next.getColorTextureView(),java.util.Optional.empty())){
    pass.setPipeline(pipeline);pass.setUniform("BlurData",uniform);
    pass.bindTexture("CurrentSampler",main.getColorTextureView(),RenderSystem.getSamplerCache().getClampToEdge(FilterMode.LINEAR));
    pass.bindTexture("HistorySampler",previous.getColorTextureView(),RenderSystem.getSamplerCache().getClampToEdge(FilterMode.LINEAR));
    pass.draw(3,1,0,0);
   }
   encoder.copyTextureToTexture(next.getColorTexture(),color,0,0,0,0,0,w,h);
   var swap=previous;previous=next;next=swap;lastTime=now;appliedFrames++;
  }catch(RuntimeException|LinkageError e){failed=true;reset();org.slf4j.LoggerFactory.getLogger("XRN Motion Blur").warn("Motion Blur suspended: {}",e.toString());}
 }
 public static void reset(){if(previous!=null){previous.destroyBuffers();previous=null;}if(next!=null){next.destroyBuffers();next=null;}if(uniform!=null){uniform.close();uniform=null;}seeded=false;lastTime=0;lastWorld=null;}
 static void load(JsonObject o){enabled=o.has("motionBlur")&&o.get("motionBlur").getAsBoolean();if(o.has("motionBlurIntensity"))setIntensity(o.get("motionBlurIntensity").getAsInt());}
 static void save(JsonObject o){o.addProperty("motionBlur",enabled);o.addProperty("motionBlurIntensity",intensity);}
}
