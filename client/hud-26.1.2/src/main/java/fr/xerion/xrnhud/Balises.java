package fr.xerion.xrnhud;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.level.storage.LevelResource;

/** Private local waypoints, isolated by server/world and dimension. */
final class Balises {
    static boolean visible=true;
    static int couleur=0xFFC4AEFF,hauteur=256;
    record Point(String id,String name,String world,String dimension,double x,double y,double z,boolean enabled){}
    private static final List<Point> points=new ArrayList<>();
    private static boolean loaded;
    static String erreur="";
    private static Path fichier(){return FabricLoader.getInstance().getConfigDir().resolve("xrn-waypoints.json");}
    static String monde(Minecraft cl){
        var server=cl.getCurrentServer();if(server!=null)return "server:"+server.ip.toLowerCase(java.util.Locale.ROOT);
        var local=cl.getSingleplayerServer();return local==null?"":"local:"+local.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize();
    }
    static List<Point> liste(Minecraft cl){charger();String world=monde(cl);return points.stream().filter(p->p.world.equals(world)).toList();}
    private static void charger(){
        if(loaded)return;loaded=true;Path file=fichier();if(!Files.exists(file))return;
        try{
            if(Files.size(file)>256*1024)throw new IllegalArgumentException("Fichier trop volumineux");
            List<Point> saved=new Gson().fromJson(Files.readString(file),new TypeToken<List<Point>>(){}.getType());
            if(saved!=null)for(Point p:saved){if(points.size()>=256)break;if(p!=null&&p.id!=null&&p.name!=null&&p.name.length()<=28&&p.world!=null&&p.dimension!=null&&Double.isFinite(p.x)&&Double.isFinite(p.y)&&Double.isFinite(p.z)&&Math.abs(p.x)<=30_000_000&&Math.abs(p.z)<=30_000_000)points.add(p);}
        }catch(Exception e){erreur="Lecture des balises impossible";}
    }
    static boolean ajouter(Minecraft cl,String nom){
        charger();if(cl.player==null||cl.level==null)return false;
        if(points.size()>=256||liste(cl).size()>=32){erreur="32 balises maximum par monde";return false;}
        String clean=nom.replaceAll("[\\p{Cntrl}§]","").strip();if(clean.isEmpty())clean="Balise "+(liste(cl).size()+1);if(clean.length()>28)clean=clean.substring(0,28);
        var p=cl.player;points.add(new Point(UUID.randomUUID().toString(),clean,monde(cl),cl.level.dimension().identifier().toString(),p.getX(),p.getY(),p.getZ(),true));sauver();return true;
    }
    static void supprimer(String id){points.removeIf(p->p.id.equals(id));sauver();}
    static void basculer(String id){for(int i=0;i<points.size();i++){Point p=points.get(i);if(p.id.equals(id)){points.set(i,new Point(p.id,p.name,p.world,p.dimension,p.x,p.y,p.z,!p.enabled));break;}}sauver();}
    private static void sauver(){
        try{Path f=fichier(),tmp=f.resolveSibling(f.getFileName()+".tmp");Files.createDirectories(f.getParent());Files.writeString(tmp,new Gson().toJson(points));try{Files.move(tmp,f,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(java.nio.file.AtomicMoveNotSupportedException e){Files.move(tmp,f,StandardCopyOption.REPLACE_EXISTING);}erreur="";}catch(Exception e){erreur="Enregistrement des balises impossible";}
    }
    static void dessiner(GuiGraphicsExtractor c,Minecraft cl){
        if(!visible||cl.player==null||cl.level==null||cl.options.hideGui||cl.screen instanceof EcranEdition)return;
        var camera=cl.gameRenderer.getMainCamera();var pos=camera.position();
        double yaw=Math.toRadians(camera.yRot()),pitch=Math.toRadians(camera.xRot());
        int w=cl.getWindow().getGuiScaledWidth(),h=cl.getWindow().getGuiScaledHeight();
        double focal=h/(2*Math.tan(Math.toRadians(cl.options.fov().get())/2));
        String dimension=cl.level.dimension().identifier().toString();
        for(Point p:liste(cl)){
            if(!p.enabled||!p.dimension.equals(dimension))continue;
            double dx=p.x-pos.x,dy=p.y+.7-pos.y,dz=p.z-pos.z;
            double[] base=vue(dx,dy,dz,yaw,pitch);
            double distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
            var mask=masque(cl,p,pos);
            // Draw only intervals with clear world-space sight lines. Roofs and walls occlude the beam.
            for(int part=0;part<24;part++){
                if(!mask[part] || !mask[part+1])continue;
                double[] low=vue(dx,dy+hauteur*part/24.0,dz,yaw,pitch),high=vue(dx,dy+hauteur*(part+1)/24.0,dz,yaw,pitch);
                if(low[2]<=.05&&high[2]<=.05)continue;
                if(low[2]<.05)pres(low,high);if(high[2]<.05)pres(high,low);
                double[] segment={w/2.0+low[0]*focal/low[2],h/2.0-low[1]*focal/low[2],w/2.0+high[0]*focal/high[2],h/2.0-high[1]*focal/high[2]};
                if(decouper(segment,w,h))trait(c,segment);
            }
            if(!mask[0] || base[2]<=.05)continue;
            double sx=w/2.0+base[0]*focal/base[2],sy=h/2.0-base[1]*focal/base[2];
            if(sx<5||sx>w-5||sy<5||sy>h-24)continue;
            int x=(int)Math.round(sx),y=(int)Math.round(sy);
            Theme.arrondi(c,x-4,y-4,9,9,0xDD21182D,couleur);
            String label=p.name+" · "+(distance>=1000?String.format(java.util.Locale.ROOT,"%.1f km",distance/1000):(int)distance+" m");
            int textWidth=cl.font.width(label);int textX=Math.max(3,Math.min(w-textWidth-3,x-textWidth/2));
            Theme.texte(c,cl.font,label,textX,y+11,Theme.TEXTE);
        }
    }
    private record Visibilite(long time,net.minecraft.world.phys.Vec3 from,int height,boolean[] mask){}
    private static final java.util.Map<String,Visibilite> cache=new java.util.HashMap<>();
    private static boolean[] masque(Minecraft cl,Point p,net.minecraft.world.phys.Vec3 from){
        long now=System.nanoTime();var old=cache.get(p.id);
        if(old!=null && old.height==hauteur && now-old.time<250_000_000L && from.distanceToSqr(old.from)<.25)return old.mask;
        boolean[] mask=new boolean[25];
        for(int i=0;i<mask.length;i++)mask[i]=libre(cl,from,new net.minecraft.world.phys.Vec3(p.x,p.y+.7+hauteur*i/24.0,p.z));
        if(cache.size()>256)cache.clear();cache.put(p.id,new Visibilite(now,from,hauteur,mask));return mask;
    }
    static boolean libre(Minecraft cl,net.minecraft.world.phys.Vec3 from,net.minecraft.world.phys.Vec3 to){
        var hit=cl.level.clip(new net.minecraft.world.level.ClipContext(from,to,net.minecraft.world.level.ClipContext.Block.VISUAL,net.minecraft.world.level.ClipContext.Fluid.NONE,cl.player));
        return hit.getType()==net.minecraft.world.phys.HitResult.Type.MISS;
    }
    // Both endpoints are fixed world positions. Pitch changes their projection, never their location.
    static double[] vue(double dx,double dy,double dz,double yaw,double pitch){
        double horizontal=-dx*Math.sin(yaw)+dz*Math.cos(yaw);
        return new double[]{-dx*Math.cos(yaw)-dz*Math.sin(yaw),dy*Math.cos(pitch)+horizontal*Math.sin(pitch),horizontal*Math.cos(pitch)-dy*Math.sin(pitch)};
    }
    private static void pres(double[] behind,double[] front){double t=(.05-behind[2])/(front[2]-behind[2]);for(int i=0;i<3;i++)behind[i]+=(front[i]-behind[i])*t;behind[2]=.05;}
    static boolean decouper(double[] line,int w,int h){
        double dx=line[2]-line[0],dy=line[3]-line[1],lo=0,hi=1;
        double[] p={-dx,dx,-dy,dy},q={line[0],w-1-line[0],line[1],h-1-line[1]};
        for(int i=0;i<4;i++){if(Math.abs(p[i])<1e-9){if(q[i]<0)return false;continue;}double t=q[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}
        double x=line[0],y=line[1];line[0]=x+lo*dx;line[1]=y+lo*dy;line[2]=x+hi*dx;line[3]=y+hi*dy;return true;
    }
    private static void trait(GuiGraphicsExtractor c,double[] line){
        float length=(float)Math.hypot(line[2]-line[0],line[3]-line[1]);
        c.pose().pushMatrix();c.pose().translate((float)line[0],(float)line[1]);c.pose().rotate((float)Math.atan2(line[3]-line[1],line[2]-line[0]));
        Theme.rect(c,0,-1,(int)Math.ceil(length),3,Theme.alpha(couleur,.20));Theme.rect(c,0,0,(int)Math.ceil(length),1,Theme.alpha(couleur,.92));c.pose().popMatrix();
    }

}
