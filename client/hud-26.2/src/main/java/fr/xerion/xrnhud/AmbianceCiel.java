package fr.xerion.xrnhud;
import net.minecraft.client.Minecraft;import net.minecraft.client.resources.sounds.AbstractTickableSoundInstance;import net.minecraft.client.resources.sounds.SoundInstance;import net.minecraft.sounds.SoundSource;import net.minecraft.sounds.SoundEvent;import net.minecraft.resources.Identifier;import net.minecraft.util.RandomSource;
/** Optional, local ambience. It follows the game's Master/Ambient volumes. */
final class AmbianceCiel {
 private static Boucle son;private static int retry;
 static boolean souhaite(Minecraft c){return Ciel.ambiance&&Ciel.volume>0&&Ciel.disponible()&&!c.isPaused()&&c.isWindowActive();}
 static void tick(Minecraft c){
  if(!souhaite(c)){if(son!=null){c.getSoundManager().stop(son);son=null;}retry=0;return;}
  if(son!=null&&retry--<=0&&!c.getSoundManager().isActive(son)){son=null;retry=0;}
  if(son==null||son.mode!=Ciel.mode){son=new Boucle(Ciel.mode);c.getSoundManager().play(son);retry=40;}
 }
 static boolean joue(){return son!=null;}
 private static final class Boucle extends AbstractTickableSoundInstance {
  final int mode;
  Boucle(int style){super(SoundEvent.createVariableRangeEvent(Identifier.fromNamespaceAndPath("xrnhud",style==0?"sky_space":"sky_clouds")),SoundSource.AMBIENT,RandomSource.create());mode=style;looping=true;delay=0;relative=true;attenuation=SoundInstance.Attenuation.NONE;volume=.001f;pitch=1;}
  public void tick(){var c=Minecraft.getInstance();float target=son==this&&souhaite(c)?Ciel.volume:0;volume+=(target-volume)*.065f;if(target==0&&volume<.002f)stop();}
 }
}
