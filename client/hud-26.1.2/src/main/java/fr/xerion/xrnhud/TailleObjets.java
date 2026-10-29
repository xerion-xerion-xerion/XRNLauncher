package fr.xerion.xrnhud;
import com.google.gson.JsonObject;
import net.minecraft.world.item.ItemStack;
import net.minecraft.core.registries.BuiltInRegistries;
public final class TailleObjets {
 public static boolean actif=false,enMain=true,inventaire=false;
 private static final java.util.Map<String,Float> tailles=new java.util.LinkedHashMap<>();
 private TailleObjets(){}
 public static String id(ItemStack stack){return stack==null||stack.isEmpty()?"":BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();}
 public static float taille(String id){return tailles.getOrDefault(id,1f);}
 static void modifier(String id,float scale){if(!id.matches("[a-z0-9_.-]+:[a-z0-9_./-]+")||id.length()>160||!Float.isFinite(scale))return;scale=Math.clamp(Math.round(scale*10)/10f,.5f,2.5f);if(scale==1)tailles.remove(id);else if(tailles.containsKey(id)||tailles.size()<128)tailles.put(id,scale);}
 public static float facteur(ItemStack stack,boolean gui){if(!actif||(gui?!inventaire:!enMain))return 1;return Math.clamp(taille(id(stack)),.5f,gui?1.75f:2.5f);}
 static void charger(JsonObject o){actif=o.has("itemScaleEnabled")&&o.get("itemScaleEnabled").getAsBoolean();enMain=!o.has("itemScaleHand")||o.get("itemScaleHand").getAsBoolean();inventaire=o.has("itemScaleGui")&&o.get("itemScaleGui").getAsBoolean();tailles.clear();if(o.has("itemScales")&&o.get("itemScales").isJsonObject())for(var entry:o.getAsJsonObject("itemScales").entrySet())try{modifier(entry.getKey(),entry.getValue().getAsFloat());}catch(RuntimeException ignored){}}
 static void sauver(JsonObject o){o.addProperty("itemScaleEnabled",actif);o.addProperty("itemScaleHand",enMain);o.addProperty("itemScaleGui",inventaire);JsonObject values=new JsonObject();tailles.forEach(values::addProperty);o.add("itemScales",values);}
}
