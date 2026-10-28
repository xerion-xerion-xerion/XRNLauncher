package fr.xerion.xrnhud;
public final class CapeMouvement {
 public static boolean naturel=true;
 private CapeMouvement(){}
 static float apercu(){return naturel?6+(float)(Math.sin(System.nanoTime()/1_000_000_000.0*1.8)*5+5):6;}
}
