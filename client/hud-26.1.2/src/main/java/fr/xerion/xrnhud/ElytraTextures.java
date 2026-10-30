package fr.xerion.xrnhud;
import java.util.*;import java.nio.file.*;import java.nio.charset.StandardCharsets;import java.io.*;import java.awt.image.BufferedImage;import java.awt.Graphics2D;import javax.imageio.ImageIO;
import net.minecraft.resources.Identifier;import net.minecraft.client.Minecraft;import com.mojang.blaze3d.platform.NativeImage;import net.minecraft.client.renderer.texture.DynamicTexture;
/** A wing atlas uses the Elytra model UVs, never the cape atlas UVs. */
public final class ElytraTextures {
 private static final LinkedHashMap<String,Identifier> cache=new LinkedHashMap<>(64,.75f,true);private static final Map<String,Long> retry=new HashMap<>();
 public static final Identifier DEFAULT=Identifier.fromNamespaceAndPath("minecraft","textures/entity/equipment/wings/elytra.png");
 private ElytraTextures(){}
 public static Identifier texture(String id){Identifier cape=Droits.texture(id);if(cape==null)return null;if(!id.startsWith("prime_"))return Identifier.fromNamespaceAndPath("xrnhud",cape.getPath().replace("textures/cosmetics/","textures/elytra/"));String key=cape.toString();Identifier old=cache.get(key);if(old!=null)return old;if(retry.getOrDefault(key,0L)>System.currentTimeMillis())return DEFAULT;
  var mc=Minecraft.getInstance();try{
   BufferedImage source;if(id.startsWith("prime_")){String root=System.getProperty("XRNPrimeCapes","");if(root.isEmpty())return DEFAULT;try(var in=Files.newInputStream(Path.of(root).resolve(id+".png"))){source=ImageIO.read(in);}}else{try(var in=mc.getResourceManager().getResource(cape).orElseThrow().open()){source=ImageIO.read(in);}}
   if(source==null||source.getWidth()>2048||source.getHeight()>1024)throw new IOException("Invalid cape atlas");
   var result=convert(source);var bytes=new ByteArrayOutputStream();ImageIO.write(result,"png",bytes);result.flush();source.flush();var image=NativeImage.read(bytes.toByteArray());String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8))).substring(0,32);Identifier name=Identifier.fromNamespaceAndPath("xrnhud","elytra/generated/"+hash);var manager=mc.getTextureManager();manager.register(name,new DynamicTexture(()->"XRN Elytra",image));cache.put(key,name);while(cache.size()>192)manager.release(cache.remove(cache.keySet().iterator().next()));return name;
  }catch(Exception ignored){if(retry.size()>192)retry.clear();retry.put(key,System.currentTimeMillis()+3000);return DEFAULT;}
 }
 public static BufferedImage convert(BufferedImage source){var out=new BufferedImage(512,256,BufferedImage.TYPE_INT_ARGB);Graphics2D g=out.createGraphics();int scale=source.getWidth()/64,sy=source.getHeight()/32;g.drawImage(source,0,0,512,256,scale,sy,scale*11,sy*17,null);for(int x:new int[]{24,36})g.drawImage(source,x*8,16,(x+10)*8,176,scale,sy,scale*11,sy*17,null);g.dispose();return out;}
 public static int cached(){return cache.size();}
}
