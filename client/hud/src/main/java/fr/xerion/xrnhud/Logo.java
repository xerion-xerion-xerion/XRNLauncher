package fr.xerion.xrnhud;

import net.minecraft.text.StyleSpriteSource;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/**
 * Le logo du client, accroche au pseudo.
 *
 * <p>Le logo n est pas dessine par le mod : c est le jeu qui le dessine,
 * comme du texte, a cote du pseudo. Le mod ajoute simplement un caractere
 * au nom affiche (voir le mixin sur le nom du joueur) et fournit la
 * police qui lui donne son dessin.
 *
 * <p>Pourquoi passer par le texte plutot que projeter une image a l
 * ecran : une image projetee derive des que la camera bouge, et son
 * decalage change avec l angle de vue. Un caractere, lui, est toujours
 * exactement ou le jeu l a place.
 */
public final class Logo {

    /*  Le joueur peut desactiver le logo s il prefere l aspect
        d origine de Minecraft.                                          */
    public static boolean actif = true;

    /*  Caractere utilise. Il est rendu par la police bitmap ajoutee
        par le mod, en assets/minecraft/font/xrnhud.json. La texture
        est referencee en relatif au dossier textures/, d ou
        "minecraft:xrnhud/logo.png" et non "minecraft:textures/...".  */
    public static final String CARACTERE = "\uE000";

    /*  Police qui donne son dessin au caractere.

        Vanilla ne fusionne pas les polices par defaut des autres
        namespaces : assets/minecraft/font/default.json ne reference
        que include/space, include/default et include/unifont. Un
        fichier font/xrnhud.json cree donc une police autonome, jamais
        utilisee. On la vise donc explicitement, en la nommant dans le
        style du texte : le jeu va alors chercher le glyphe dans cette
        police la, ou elle est reellement chargee.                      */
    public static final Identifier POLICE = Identifier.of("minecraft", "xrnhud");

    private Logo() {}
    public static Text decorer(Text nom) {
        boolean already=nom.visit((style,value) -> value.contains(CARACTERE) && style.getFont().equals(new StyleSpriteSource.Font(POLICE)) ? java.util.Optional.of(true) : java.util.Optional.<Boolean>empty(), net.minecraft.text.Style.EMPTY).isPresent();
        if (already) return nom;
        return Text.empty().append(texte()).append(Text.literal(" ")).append(nom);
    }

    /** Le caractere du logo, avec le style qui pointe vers sa police. */
    public static Text texte() {
        return Text.literal(CARACTERE)
                .styled(style -> style.withFont(new StyleSpriteSource.Font(POLICE)));
    }
    public static net.minecraft.text.Text decorerPrime(net.minecraft.text.Text nom,boolean prime,boolean logo){
        if(prime)nom=net.minecraft.text.Text.empty().append(net.minecraft.text.Text.literal("+ ").styled(s->s.withColor(0xC8ACFF))).append(nom);
        return logo?decorer(nom):nom;
    }
}
