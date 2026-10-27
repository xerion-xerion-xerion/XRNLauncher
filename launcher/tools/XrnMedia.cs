using System;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using System.Threading;
using Windows.Foundation;
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

    /*  La position annoncee par Windows, et celle que l on publie.
        Voir la partie "La position" dans Ecrire().                      */
    static long positionAnnoncee = -1;
    static long positionPubliee = 0;
    static long dernierChangement = 0;

    /*  Attendre la fin d une operation WinRT.

        WinRT ne livre la fin d une operation que sur le fil qui a
        demande, via la file de messages de son appartement. Un
        programme de console n a ni file ni boucle de messages : la
        methode AsTask() de Microsoft se fait alors annuler
        (RPC_E_CALL_CANCELED) des que la machine est occupee.

        On attend donc en pompant nous-memes les messages, ce qui est
        la facon fiable de parler a WinRT depuis un programme de
        console. Le programme tourne en STA pour cette raison.        */
    static T Attendre<T>(Windows.Foundation.IAsyncOperation<T> operation)
    {
        DateTime limite = DateTime.UtcNow.AddSeconds(10);
        while (operation.Status == Windows.Foundation.AsyncStatus.Started)
        {
            if (DateTime.UtcNow > limite) throw new TimeoutException("l operation WinRT n a pas repondu");
            PomperMessages(20);
        }
        return operation.GetResults();
    }

    /*  La structure d un message Windows, et les trois appels utiles. */
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int x;
        public int y;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool PeekMessage(out MSG msg, IntPtr fenetre, uint min, uint max, uint retrait);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool TranslateMessage(ref MSG msg);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern IntPtr DispatchMessage(ref MSG msg);

    /*  Traite les messages en attente, pendant le temps demande. */
    static void PomperMessages(int millisecondes)
    {
        DateTime fin = DateTime.UtcNow.AddMilliseconds(millisecondes);
        while (DateTime.UtcNow < fin)
        {
            MSG msg;
            while (PeekMessage(out msg, IntPtr.Zero, 0, 0, 1))   // PM_REMOVE
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }
            Thread.Sleep(10);
        }
    }

    [STAThread]
    static void EcrireEtat(string value) {
        string temp = fichier + ".tmp";
        File.WriteAllText(temp, value, Utf8);
        if (File.Exists(fichier)) File.Replace(temp, fichier, null);
        else File.Move(temp, fichier);
    }

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

        System.Diagnostics.Process owner = null;
        int ownerPid;
        if (args.Length > 2 && Int32.TryParse(args[2], out ownerPid) && ownerPid > 0) {
            try { owner = System.Diagnostics.Process.GetProcessById(ownerPid); }
            catch { return; }
        }
        while (owner == null || !owner.HasExited)
        {
            /*  L erreur est ecrite sur la sortie d'erreur : le launcher
                ignore cette sortie, mais elle sert quand le programme
                est lance a la main pour comprendre ce qui bloque.      */
            try { Ecrire(); } catch (Exception e) { Console.Error.WriteLine("erreur : " + e.Message); }
            Thread.Sleep(1000);
        }
    }

    static void Ecrire()
    {
        var manager = Attendre(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        var sessions = manager.GetSessions();

        GlobalSystemMediaTransportControlsSession choisi = null;
        GlobalSystemMediaTransportControlsSession enPause = null;
        foreach (var session in sessions)
        {
            string etat = session.GetPlaybackInfo().PlaybackStatus.ToString();
            /*  Une session en lecture passe avant une session en pause :
                un lecteur de musique arrete, une video continue, et c'est
                celle-la qui interesse l ecran.                           */
            if (etat == "Playing") { choisi = session; break; }
            if (etat == "Paused" && enPause == null) enPause = session;
        }
        if (choisi == null) choisi = enPause;
        if (choisi == null && sessions.Count > 0) choisi = sessions[0];

        if (choisi == null)
        {
            if (dernier != "")
            {
                dernier = "";
                EcrireEtat("{\"titre\":\"\",\"etat\":\"stopped\"}");
            }
            return;
        }

        var medias = Attendre(choisi.TryGetMediaPropertiesAsync());
        if (medias == null) return;

        var info = choisi.GetPlaybackInfo();
        var chrono = choisi.GetTimelineProperties();
        string etatLecture = info.PlaybackStatus.ToString();

        long maintenant = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;

        /*  La position.

            Windows annonce la position de lecture, mais certains
            lecteurs arretent de la mettre a jour quand ils passent en
            arriere-plan : la position reste alors figee, et le temps
            ecoule ne bouge plus a l'ecran.

            On suit donc Windows quand il bouge, et on compte nous-memes
            le temps passe quand il se tait. Le compteur de gauche
            avance toujours, et celui de droite, lui, ne bouge pas. */
        long annoncee = (long)chrono.Position.TotalMilliseconds;
        if (annoncee != positionAnnoncee)
        {
            positionAnnoncee = annoncee;
            positionPubliee = annoncee;
            dernierChangement = maintenant;
        }
        else if (etatLecture == "Playing" && maintenant - dernierChangement >= 1000)
        {
            positionPubliee += maintenant - dernierChangement;
            dernierChangement = maintenant;
        }
        long position = positionPubliee;

        /*  La duree totale de la piste : l'ecart entre le debut et la
            fin annoncees par Windows. Attention a ne pas y ajouter la
            position : le total doit rester fixe, sinon il avance avec
            le temps ecoule et le compteur de droite grossit sans fin. */
        long duree = (long)(chrono.EndTime - chrono.StartTime).TotalMilliseconds;
        if (duree < 0) duree = 0;

        string application = choisi.SourceAppUserModelId ?? "";
        if (application.EndsWith(".exe")) application = application.Substring(0, application.Length - 4);

        string cle = medias.Title + "|" + medias.Artist + "|" + etatLecture + "|" + position;
        if (cle == dernier) return;
        dernier = cle;

        string cheminPochette = EcrirePochette(medias);

        string json = "{"
            + "\"titre\":" + Texte(medias.Title) + ","
            + "\"artiste\":" + Texte(medias.Artist) + ","
            + "\"album\":" + Texte(medias.AlbumTitle) + ","
            + "\"application\":" + Texte(application) + ","
            + "\"etat\":" + Texte(etatLecture) + ","
            + "\"position\":" + position + ","
            + "\"duree\":" + duree + ","
            + "\"pochette\":" + Texte(cheminPochette)
            + "}";
        EcrireEtat(json);
    }

    static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

    /*  La pochette : Windows la donne en JPEG, le jeu ne lit que le
        PNG. On convertit au passage.                                  */
    static string EcrirePochette(GlobalSystemMediaTransportControlsSessionMediaProperties medias)
    {
        try
        {
            if (medias.Thumbnail == null) return "";
            using (var flux = Attendre(medias.Thumbnail.OpenReadAsync()))
            using (var entre = flux.AsStreamForRead())
            {
                var memoire = new MemoryStream();
                entre.CopyTo(memoire);
                byte[] octets = memoire.ToArray();
                using (var source = System.Drawing.Image.FromStream(new MemoryStream(octets)))
                using (var cible = new System.Drawing.Bitmap(64, 64))
                using (var dessin = System.Drawing.Graphics.FromImage(cible))
                {
                    dessin.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    dessin.DrawImage(source, new System.Drawing.Rectangle(0, 0, 64, 64));
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
