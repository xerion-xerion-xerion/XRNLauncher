using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Text;
using System.Threading;
using Windows.Media.Control;
using Windows.Storage.Streams;

/*
 *  Detecte la musique en cours de lecture sous Windows.
 *
 *  Windows expose une seule API pour tous les lecteurs : le System
 *  Media Transport Controls. Spotify, Deezer et tout ce qui s'y
 *  declare passent par la.
 *
 *  Le resultat est ecrit dans un fichier JSON que le mod lit ensuite.
 *  Un fichier plutot qu'un port ouvert : le jeu n'a rien a demarrer,
 *  et rien ne tourne quand le jeu est ferme.
 */
static class XrnMedia
{
    static string fichier = "";
    static string pochette = "";
    static string dernier = "";

    static void Main(string[] args)
    {
        if (args.Length > 0) fichier = args[0];
        if (args.Length > 1) pochette = args[1];
        if (fichier == "") fichier = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "XRNLauncher", "media.json");
        if (pochette == "") pochette = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "XRNLauncher", "media.png");

        while (true)
        {
            try { Ecrire(); } catch { }
            Thread.Sleep(1000);
        }
    }

    static void Ecrire()
    {
        var manager = GlobalSystemMediaTransportControlsSessionManager
                .RequestAsync().AsTask().GetAwaiter().GetResult();
        var sessions = manager.GetSessions();

        GlobalSystemMediaTransportControlsSession choisi = null;
        foreach (var session in sessions)
        {
            string etat = session.GetPlaybackInfo().PlaybackStatus.ToString();
            if (etat == "Playing" || etat == "Paused") { choisi = session; break; }
        }
        if (choisi == null && sessions.Count > 0) choisi = sessions[0];

        if (choisi == null)
        {
            if (dernier != "")
            {
                dernier = "";
                File.WriteAllText(fichier, "{\"titre\":\"\",\"etat\":\"stopped\"}", Utf8);
            }
            return;
        }

        var medias = choisi.TryGetMediaPropertiesAsync().AsTask().GetAwaiter().GetResult();
        if (medias == null) return;

        var info = choisi.GetPlaybackInfo();
        var chrono = choisi.GetTimelineProperties();

        long position = (long)chrono.Position.TotalMilliseconds;
        long restant = (long)(chrono.EndTime - chrono.StartTime).TotalMilliseconds;
        if (restant < 0) restant = 0;
        long duree = position + restant;

        string application = choisi.SourceAppUserModelId ?? "";
        if (application.EndsWith(".exe")) application = application.Substring(0, application.Length - 4);

        string cle = medias.Title + "|" + medias.Artist + "|" + info.PlaybackStatus + "|" + position;
        if (cle == dernier) return;
        dernier = cle;

        string cheminPochette = EcrirePochette(medias);

        string json = "{"
            + "\"titre\":" + Texte(medias.Title) + ","
            + "\"artiste\":" + Texte(medias.Artist) + ","
            + "\"album\":" + Texte(medias.AlbumTitle) + ","
            + "\"application\":" + Texte(application) + ","
            + "\"etat\":" + Texte(info.PlaybackStatus.ToString()) + ","
            + "\"position\":" + position + ","
            + "\"duree\":" + duree + ","
            + "\"pochette\":" + Texte(cheminPochette)
            + "}";
        File.WriteAllText(fichier, json, Utf8);
    }

    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

    /*  La pochette : Windows la donne en JPEG, le jeu ne lit que le
        PNG. On convertit au passage.                                  */
    static string EcrirePochette(GlobalSystemMediaTransportControlsSessionMediaProperties medias)
    {
        try
        {
            if (medias.Thumbnail == null) return "";
            using (var flux = medias.Thumbnail.OpenReadAsync().AsTask().GetAwaiter().GetResult())
            using (var entre = flux.AsStreamForRead())
            using (var entree = new MemoryStream())
            {
                entre.CopyTo(entree);
                byte[] octets = entree.ToArray();

                /*  Windows livre une pochette de 150 a 256 pixels. Le jeu
                    l'affiche en 32, et il dessine en nearest : on
                    reduit donc nous-memes, sinon l'image devient un
                    bruit de pixels.                                      */
                using (var source = Image.FromStream(new MemoryStream(octets)))
                using (var cible = new Bitmap(64, 64))
                using (var dessin = Graphics.FromImage(cible))
                {
                    dessin.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    dessin.DrawImage(source, new Rectangle(0, 0, 64, 64));
                    cible.Save(pochette, System.Drawing.Imaging.ImageFormat.Png);
                }
            }
            return pochette;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("pochette : " + e.Message);
            return "";
        }
    }

    /*  Un JSON sans dependance : on echappe a la main. */
    static string Texte(string s)
    {
        if (s == null) return "\"\"";
        var b = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') b.Append('\\').Append(c);
            else if (c == '\n') b.Append("\\n");
            else if (c == '\r') b.Append("\\r");
            else if (c == '\t') b.Append("\\t");
            else if (c < 32) b.Append("\\u").Append(((int)c).ToString("x4"));
            else b.Append(c);
        }
        return b.Append('"').ToString();
    }
}
