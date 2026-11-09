"""The length a Quiet Panic video and its audio can both be cut to.

The audio reader can report a slightly shorter length than the probed length of the encoded file. The video was then
asked for audio past the reader's end and failed with "OSError: Accessing time t=X, with clip duration=Y" (runs
42017447119 on 5 Nov and 42364147901 on 7 Nov). Both tracks are cut to the shorter of the two lengths, so they end
together and no read goes past the audio.
"""


def usable_av_duration(reader_seconds, probed_seconds):
    probed = float(probed_seconds)
    if probed <= 0:
        raise ValueError("probed audio duration must be positive")
    if reader_seconds is None:
        return probed
    reader = float(reader_seconds)
    if reader <= 0:
        raise ValueError("audio reader duration must be positive")
    return min(reader, probed)
