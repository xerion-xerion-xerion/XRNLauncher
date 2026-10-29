package fr.xerion.xrnhud;
import net.minecraft.client.MinecraftClient;import net.minecraft.client.sound.MovingSoundInstance;import net.minecraft.client.sound.SoundInstance;import net.minecraft.sound.SoundCategory;import net.minecraft.sound.SoundEvent;import net.minecraft.util.Identifier;import net.minecraft.util.math.random.Random;
/** Optional, local ambience. It follows the game's Master/Ambient volumes. */
final class AmbianceCiel {
 private static Boucle son;private static int retry;
 static boolean souhaite(MinecraftClient c){return Ciel.ambiance&&Ciel.volume>0&&Ciel.disponible()&&!c.isPaused()&&c.isWindowFocused();}
 static void tick(MinecraftClient c){
  if(!souhaite(c)){if(son!=null){c.getSoundManager().stop(son);son=null;}retry=0;return;}
  if(son!=null&&retry--<=0&&!c.getSoundManager().isPlaying(son)){son=null;retry=0;}
  if(son==null||son.mode!=Ciel.mode){son=new Boucle(Ciel.mode);c.getSoundManager().play(son);retry=40;}
 }
 static boolean joue(){return son!=null;}
 private static final class Boucle extends MovingSoundInstance {
  final int mode;
  Boucle(int style){super(SoundEvent.of(Identifier.of("xrnhud",style==0?"sky_space":"sky_clouds")),SoundCategory.AMBIENT,Random.create());mode=style;repeat=true;repeatDelay=0;relative=true;attenuationType=SoundInstance.AttenuationType.NONE;volume=.001f;pitch=1;}
  public void tick(){var c=MinecraftClient.getInstance();float target=son==this&&souhaite(c)?Ciel.volume:0;volume+=(target-volume)*.065f;if(target==0&&volume<.002f)setDone();}
 }
}
