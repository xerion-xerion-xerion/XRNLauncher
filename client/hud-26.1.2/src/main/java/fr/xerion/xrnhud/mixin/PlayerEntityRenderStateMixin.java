package fr.xerion.xrnhud.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import fr.xerion.xrnhud.CapeEtat;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;

/**
 * Ajoute la marque de la cape a l etat de rendu d un joueur.
 *
 * <p>Un simple champ, de la maniere la plus simple possible : pas de
 * transformateur, pas de methode heritee, juste un booleen que le
 * renderer pose et que le rendu de la cape lit.
 */
@Mixin(AvatarRenderState.class)
public abstract class PlayerEntityRenderStateMixin implements CapeEtat {

    @Unique
    private boolean xrn$capeActif = false;

    @Unique
    private boolean xrn$ailesActif = false;

    @Unique
    private String xrn$cosmetiqueActif = "";

    @Override
    public boolean xrn$cape() {
        return this.xrn$capeActif;
    }

    @Override
    public void xrn$cape(boolean actif) {
        this.xrn$capeActif = actif;
    }

    @Override
    public boolean xrn$ailes() {
        return this.xrn$ailesActif;
    }

    @Override
    public void xrn$ailes(boolean actif) {
        this.xrn$ailesActif = actif;
    }

    @Override
    public String xrn$cosmetique() {
        return this.xrn$cosmetiqueActif;
    }

    @Override
    public void xrn$cosmetique(String id) {
        this.xrn$cosmetiqueActif = id == null ? "" : id;
    }
}
